import { readFileSync } from 'fs';
import { fdir } from 'fdir';
import { dirname, isAbsolute, resolve, sep } from 'path';
import { Diagnostic } from 'vscode-languageserver';
import { WorkspaceFolder } from 'vscode-languageserver-protocol';
import { Document, DocumentManager } from '../lib/documents';
import { configLoader } from '../lib/documents/configLoader';
import { FileSystemProvider } from '../lib/FileSystemProvider';
import { Logger } from '../logger';
import { LSConfigManager } from '../ls-config';
import { CSSPlugin } from '../plugins/css/CSSPlugin';
import { createLanguageServices } from '../plugins/css/service';
import { PluginHost } from '../plugins/PluginHost';
import { SveltePlugin } from '../plugins/svelte/SveltePlugin';
import type { TsApiAccess } from '../plugins/typescript-go/TsApiService';
import type { tsApiAsync } from '../plugins/typescript-go/types';
import type { SvelteCheckDiagnosticSource } from '../svelte-check';
import { normalizePath, pathToUrl } from '../utils';
import { ApiDiagnostic, getSvelteFileSource, toFileDiagnostic } from './convert';
import { isSvelteFile, shouldCheckFile } from './files';
import {
    ERROR_CATEGORY,
    hasContentMappers,
    isContentMapperFailure,
    missingContentMapperError,
    throwIfContentMapperFailed
} from './infrastructure';
import { postProcessSvelteDiagnostics, withUnresolvedSvelteImports } from './postprocess';
import {
    FileNotifications,
    ProjectFileDiagnostics,
    Ts7Project,
    TypeScript7Modules
} from './project';

export interface SvelteCheckTs7Options {
    /** Absolute path of the tsconfig/jsconfig. It must map `.svelte` files with the content mapper */
    tsconfig: string;
    /** The API modules of the project's TypeScript 7 (7.1 or newer) */
    typescript: TypeScript7Modules;
    /** Absolute path of a svelte.config or vite.config file */
    configPath?: string;
    compilerWarnings?: Record<string, 'ignore' | 'error'>;
    diagnosticSources?: SvelteCheckDiagnosticSource[];
}

export interface SvelteCheckFileDiagnostics {
    filePath: string;
    text: string;
    diagnostics: Diagnostic[];
}

export type FileChange = 'created' | 'changed' | 'deleted';

/** State of one `getDiagnostics` call */
interface CheckRun {
    /** Once the program is known: the Svelte files that are worth checking */
    svelteFilesToCheck?: Set<string>;
}

/**
 * svelte-check on TypeScript 7: TypeScript diagnostics come from TS7 through its API, with
 * `.svelte` files transformed by the content mapper (`@sveltejs/ts-content-mapper`) configured in
 * the tsconfig. Svelte compiler and CSS diagnostics come from the Svelte and CSS plugins, like in
 * `SvelteCheck`.
 *
 * Reports the same files as `SvelteCheck` with a tsconfig (the program's files, see `files.ts`),
 * in the same shape. Nothing in here loads TypeScript, neither 6 nor the `typescript` package of 7
 * (only its API modules, passed in as `typescript`). svelte2tsx is only loaded on demand, through
 * its TypeScript-free `svelte2tsx/tsgo` entry point, see `postprocess.ts`.
 *
 * One API session (`tsc --api`, with the content mapper process and its transforms) is kept for
 * all `getDiagnostics` calls, until `dispose`. In watch mode, the caller reports file changes with
 * `fileChanged`; the next `getDiagnostics` hands them to TS7, which derives the new snapshot from
 * the previous one.
 */
export class SvelteCheckTs7 {
    private readonly docManager = new DocumentManager(
        (textDocument) => new Document(textDocument.uri, textDocument.text)
    );
    private readonly configManager = new LSConfigManager();
    private readonly pluginHost = new PluginHost(this.docManager);
    private readonly sources: ReadonlySet<SvelteCheckDiagnosticSource>;
    private readonly tsconfigDirectory: string;
    /** Svelte compiler and CSS diagnostics per (normalized) file path */
    private readonly svelteDiagnostics = new Map<string, Promise<Diagnostic[]>>();
    private api: tsApiAsync.API | undefined;
    private project: Ts7Project | undefined;
    /** Changes since the current snapshot */
    private pendingChanges = createFileChanges();
    /** The program's files as of the last check */
    private programFiles: readonly string[] = [];

    constructor(
        workspacePath: string,
        private readonly options: SvelteCheckTs7Options
    ) {
        Logger.setLogErrorsOnly(true);
        if (!isAbsolute(options.tsconfig)) {
            throw new Error('tsconfigPath needs to be absolute, got ' + options.tsconfig);
        }
        if (options.configPath && !isAbsolute(options.configPath)) {
            throw new Error('configPath needs to be absolute, got ' + options.configPath);
        }
        this.sources = new Set(options.diagnosticSources ?? ['js', 'svelte', 'css']);
        this.tsconfigDirectory = dirname(options.tsconfig);

        // Without a Svelte config, don't preprocess with TypeScript: TypeScript 7 has no JS API (and
        // the `typescript` package may be TypeScript 7), and Svelte 5 parses TypeScript itself.
        // This applies to the whole process (the shared config loader).
        configLoader.setFallbackWithoutTypeScript(true);
        configLoader.setExplicitConfigScope(
            options.configPath
                ? { configPath: options.configPath, rootDirectory: this.tsconfigDirectory }
                : undefined
        );
        this.configManager.update({ svelte: { compilerWarnings: options.compilerWarnings } });
        // No HTMLPlugin, it does not provide diagnostics
        if (this.sources.has('svelte')) {
            this.pluginHost.register(new SveltePlugin(this.configManager, undefined));
        }
        if (this.sources.has('css')) {
            const services = createLanguageServices({
                fileSystemProvider: new FileSystemProvider()
            });
            const workspaceFolders: WorkspaceFolder[] = [
                { name: '', uri: pathToUrl(workspacePath) }
            ];
            this.pluginHost.register(
                new CSSPlugin(this.docManager, this.configManager, workspaceFolders, services)
            );
        }
    }

    /**
     * Diagnostics of all files of the tsconfig's program.
     * Throws a `SvelteCheckTs7Error` if the results can't be trusted (configuration, content mapper).
     */
    async getDiagnostics(): Promise<SvelteCheckFileDiagnostics[]> {
        const run: CheckRun = {};
        // Building the first program takes a while (the content mapper transforms every Svelte
        // file). Meanwhile, check the Svelte files below the tsconfig, most of them are in the
        // program. Later programs are derived from the previous one, and the Svelte diagnostics
        // of unchanged files are kept.
        const early = this.project
            ? Promise.resolve()
            : findSvelteFiles(this.tsconfigDirectory)
                  .then((files) => this.runSvelteDiagnostics(files, run))
                  .catch(() => {});
        try {
            return await this.check(await this.getProject(), run);
        } finally {
            run.svelteFilesToCheck = new Set();
            await early;
        }
    }

    /**
     * Watch mode: a file was created, changed or deleted on disk. TS7 gets to know on the next
     * `getDiagnostics`. It also reevaluates the tsconfig's `include` for created files, and
     * reloads the project if the tsconfig (or a config it extends) changed.
     */
    fileChanged(filePath: string, change: FileChange): void {
        // TS7 also handles `created` for files it knows (replaced) and `changed` for ones it doesn't
        const changes = this.pendingChanges;
        if (change === 'deleted') {
            changes.created.delete(filePath);
            changes.changed.delete(filePath);
        } else {
            changes.deleted.delete(filePath);
        }
        changes[change].add(filePath);

        this.svelteDiagnostics.delete(normalizePath(filePath));
        const uri = pathToUrl(filePath);
        if (this.docManager.get(uri)) {
            // read again when it's needed
            this.docManager.closeDocument(uri);
        }
    }

    /**
     * Watch mode: the directories to watch for changes. The directories of the tsconfig and the
     * ones it references, and the directories of the programs' files outside `node_modules`
     * (like the TypeScript 6 path).
     */
    getWatchDirectories(): string[] {
        const directories = [
            this.tsconfigDirectory,
            ...(this.project?.tsconfigPaths.map((tsconfig) => dirname(tsconfig)) ?? []),
            ...this.programFiles
                .filter(
                    (fileName) =>
                        shouldCheckFile(fileName) && !/[\\/]node_modules[\\/]/.test(fileName)
                )
                .map((fileName) => dirname(fileName))
        ];
        return outermostDirectories(directories);
    }

    /** Ends the TS7 API session, which also stops the content mapper */
    async dispose(): Promise<void> {
        const { api, project } = this;
        this.api = undefined;
        this.project = undefined;
        await project?.dispose();
        await api?.close().catch(() => {});
    }

    /** The project with the pending file changes applied */
    private async getProject(): Promise<Ts7Project> {
        try {
            if (!this.project) {
                // The first snapshot reads everything. Changes from now on are for the next one.
                this.pendingChanges = createFileChanges();
                this.api ??= new this.options.typescript.api.API({
                    cwd: this.tsconfigDirectory,
                    runExternalCode: true
                });
                this.project = await Ts7Project.open(
                    this.api,
                    this.options.typescript.ast,
                    this.options.tsconfig
                );
            } else {
                const changes = this.takePendingChanges();
                if (changes) {
                    await this.project.update(changes);
                }
            }
            return this.project;
        } catch (error) {
            // e.g. the API process is gone: start from scratch next time
            await this.dispose();
            throw error;
        }
    }

    private takePendingChanges(): FileNotifications | undefined {
        const { created, changed, deleted } = this.pendingChanges;
        if (!created.size && !changed.size && !deleted.size) {
            return undefined;
        }
        this.pendingChanges = createFileChanges();
        return { created: [...created], changed: [...changed], deleted: [...deleted] };
    }

    private async check(project: Ts7Project, run: CheckRun): Promise<SvelteCheckFileDiagnostics[]> {
        const programFiles = await project.getProgramFiles();
        this.programFiles = programFiles.map((file) => file.fileName);
        // TypeScript only adds Svelte files to a program when a content mapper maps `.svelte`, and
        // otherwise silently doesn't check them
        if (
            !programFiles.some((file) => isSvelteFile(file.fileName)) &&
            !hasContentMappers(project.rawConfigs)
        ) {
            const problems = await project.getProjectProblems().catch(() => []);
            // e.g. the content mapper isn't installed
            throwIfContentMapperFailed(problems, this.tsconfigDirectory);
            throw missingContentMapperError(
                project.tsconfigPaths,
                problems,
                this.tsconfigDirectory
            );
        }

        const filesToCheck = programFiles.filter((file) => shouldCheckFile(file.fileName));
        const svelteFiles = filesToCheck.filter((file) => isSvelteFile(file.fileName));
        const svelteFileNames = svelteFiles.map((file) => file.fileName);
        run.svelteFilesToCheck = new Set(svelteFileNames.map(normalizePath));
        for (const file of this.svelteDiagnostics.keys()) {
            if (!run.svelteFilesToCheck.has(file)) {
                this.svelteDiagnostics.delete(file);
            }
        }

        const typeScriptDiagnostics = project.getDiagnostics(filesToCheck, this.sources.has('js'));
        // awaited below, after the Svelte files
        typeScriptDiagnostics.catch(() => {});
        // the Svelte files that weren't checked yet, while TypeScript checks
        await this.runSvelteDiagnostics(svelteFileNames, run);
        const {
            config,
            program,
            files: diagnosticsByFile,
            semanticallyChecked
        } = await typeScriptDiagnostics;

        const fileDiagnostics = [...diagnosticsByFile.values()]
            .flat()
            .flatMap((entry) => entry.diagnostics);
        if ([...config, ...program, ...fileDiagnostics].some(isContentMapperFailure)) {
            // TS7 reports failed transforms per file, as syntax errors. The failure message names them.
            const failedTransforms = this.sources.has('js')
                ? fileDiagnostics
                : await project.getSyntacticDiagnostics(svelteFiles).catch(() => []);
            throwIfContentMapperFailed(
                [...config, ...program, ...failedTransforms],
                this.tsconfigDirectory
            );
        }

        const checked = new Set(filesToCheck.map((file) => file.fileName));
        // Concurrently: post-processing and the unresolved-import lookup wait for the TS7 API
        const result: SvelteCheckFileDiagnostics[] = await Promise.all(
            programFiles.map(async ({ fileName, tsconfigs }) => {
                if (!checked.has(fileName)) {
                    return { filePath: fileName, text: '', diagnostics: [] };
                }
                const byProgram = withSemanticallyCheckedPrograms(
                    diagnosticsByFile.get(fileName) ?? [],
                    tsconfigs,
                    semanticallyChecked
                );
                return isSvelteFile(fileName)
                    ? this.getSvelteFileDiagnostics(fileName, byProgram)
                    : getScriptFileDiagnostics(fileName, byProgram);
            })
        );

        // like TS6 svelte-check: program-wide and global errors are warnings
        // TODO change for next major version?
        result.push(
            ...this.reportProjectDiagnostics([
                ...config,
                ...program.map((diagnostic) =>
                    diagnostic.category === ERROR_CATEGORY
                        ? { ...diagnostic, category: 0 }
                        : diagnostic
                )
            ])
        );
        return result;
    }

    /** Post-processed in each project that contains the file, identical diagnostics once */
    private async getSvelteFileDiagnostics(
        filePath: string,
        typeScriptDiagnostics: FileDiagnosticsByProgram[]
    ): Promise<SvelteCheckFileDiagnostics> {
        const svelteDiagnostics = (await this.svelteDiagnostics.get(normalizePath(filePath))) ?? [];
        const document = this.getDocument(filePath);
        const diagnostics: Diagnostic[] = [];
        for (const {
            program,
            diagnostics: projectDiagnostics,
            semanticallyChecked
        } of typeScriptDiagnostics) {
            if (projectDiagnostics.length || semanticallyChecked) {
                diagnostics.push(
                    ...(await postProcessSvelteDiagnostics(document, projectDiagnostics, program, {
                        source: getSvelteFileSource(document),
                        keepMapperDiagnostics: !this.sources.has('svelte'),
                        unresolvedSvelteImports: semanticallyChecked
                    }))
                );
            }
        }
        return {
            filePath,
            text: document.getText(),
            diagnostics: [...svelteDiagnostics, ...dedupeLspDiagnostics(diagnostics)]
        };
    }

    /**
     * Svelte compiler and CSS diagnostics, one file after the other. Yields to the event loop in
     * between, so that responses of the TS7 API are handled while this runs.
     */
    private async runSvelteDiagnostics(files: readonly string[], run: CheckRun): Promise<void> {
        if (!this.sources.has('svelte') && !this.sources.has('css')) {
            return;
        }
        for (const file of files) {
            const key = normalizePath(file);
            if (
                this.svelteDiagnostics.has(key) ||
                (run.svelteFilesToCheck && !run.svelteFilesToCheck.has(key))
            ) {
                continue;
            }
            const diagnostics = this.pluginHost.getDiagnostics({
                uri: this.getDocument(file).uri
            });
            this.svelteDiagnostics.set(key, diagnostics);
            // errors surface when the results are collected
            await diagnostics.catch(() => {});
            await new Promise((resolve) => setImmediate(resolve));
        }
    }

    private getDocument(filePath: string): Document {
        const uri = pathToUrl(filePath);
        return (
            this.docManager.get(uri) ??
            this.docManager.openClientDocument({ uri, text: readFileSync(filePath, 'utf-8') })
        );
    }

    /** Diagnostics without a file are reported for the tsconfig */
    private reportProjectDiagnostics(diagnostics: ApiDiagnostic[]): SvelteCheckFileDiagnostics[] {
        const byFile = new Map<string, ApiDiagnostic[]>();
        for (const diagnostic of diagnostics) {
            const filePath = diagnostic.fileName ?? this.options.tsconfig;
            byFile.set(filePath, [...(byFile.get(filePath) ?? []), diagnostic]);
        }
        return [...byFile].map(([filePath, fileDiagnostics]) => {
            const lspDiagnostics = fileDiagnostics.map(toFileDiagnostic);
            return {
                filePath,
                text: lspDiagnostics.some((diagnostic) => !diagnostic.data?.positionUnknown)
                    ? readFileSync(filePath, 'utf-8')
                    : '',
                diagnostics: lspDiagnostics
            };
        });
    }
}

function createFileChanges(): Record<FileChange, Set<string>> {
    return { created: new Set(), changed: new Set(), deleted: new Set() };
}

/** Like svelte-check's `findFiles`: no node_modules and no hidden directories */
function findSvelteFiles(directory: string): Promise<string[]> {
    return new fdir()
        .filter((filePath) => isSvelteFile(filePath))
        .exclude((dirName) => dirName === 'node_modules' || dirName.startsWith('.'))
        .withPathSeparator('/')
        .withFullPaths()
        .crawl(directory)
        .withPromise();
}

/** The TypeScript diagnostics of a file in one of the programs that contain it */
interface FileDiagnosticsByProgram extends ProjectFileDiagnostics {
    /** The program got to the semantic check (see `ProjectDiagnostics.semanticallyChecked`) */
    semanticallyChecked: boolean;
}

/**
 * Per program that contains the file: its diagnostics, also for the programs without any that
 * got to the semantic check (svelte-check adds semantic diagnostics of its own there)
 */
function withSemanticallyCheckedPrograms(
    diagnostics: ProjectFileDiagnostics[],
    tsconfigs: readonly string[],
    semanticallyChecked: ReadonlyMap<string, TsApiAccess>
): FileDiagnosticsByProgram[] {
    const checkedPrograms = new Set(
        tsconfigs
            .map((tsconfig) => semanticallyChecked.get(tsconfig))
            .filter((program): program is TsApiAccess => !!program)
    );
    const result: FileDiagnosticsByProgram[] = diagnostics.map((entry) => ({
        ...entry,
        semanticallyChecked: checkedPrograms.has(entry.program)
    }));
    for (const program of checkedPrograms) {
        if (!diagnostics.some((entry) => entry.program === program)) {
            result.push({ program, diagnostics: [], semanticallyChecked: true });
        }
    }
    return result;
}

/** Declaration files, also of arbitrary extensions (`.d.svelte.ts`) */
const DECLARATION_FILE = /\.d(\.[^/.]+)?\.[cm]?ts$/;

/** TS/JS files: like TypeScript, plus unresolved `.svelte` imports (see `withUnresolvedSvelteImports`) */
async function getScriptFileDiagnostics(
    fileName: string,
    typeScriptDiagnostics: FileDiagnosticsByProgram[]
): Promise<SvelteCheckFileDiagnostics> {
    let text: string | undefined;
    const diagnostics: Diagnostic[] = [];
    for (const {
        program,
        diagnostics: projectDiagnostics,
        semanticallyChecked
    } of typeScriptDiagnostics) {
        let converted = projectDiagnostics.map(toFileDiagnostic);
        if (semanticallyChecked && !DECLARATION_FILE.test(fileName)) {
            text ??= readFileSync(fileName, 'utf-8');
            // the `source` of the file's other TypeScript diagnostics
            converted = await withUnresolvedSvelteImports(
                converted,
                program,
                pathToUrl(fileName),
                text,
                undefined
            );
        }
        diagnostics.push(...converted);
    }
    const deduped = dedupeLspDiagnostics(diagnostics);
    return {
        filePath: fileName,
        text: deduped.length ? (text ?? readFileSync(fileName, 'utf-8')) : '',
        diagnostics: deduped
    };
}

/** The same diagnostic from several projects is reported once */
function dedupeLspDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
    const seen = new Set<string>();
    return diagnostics.filter((diagnostic) => {
        const key = JSON.stringify([
            diagnostic.range,
            diagnostic.severity,
            diagnostic.code,
            diagnostic.source,
            diagnostic.message
        ]);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

/** Without the ones inside others */
function outermostDirectories(directories: string[]): string[] {
    const sorted = [...new Set(directories.map((directory) => resolve(directory)))].sort();
    const result: string[] = [];
    for (const directory of sorted) {
        // sorted, so a parent comes right before its subdirectories
        const parent = result[result.length - 1];
        if (!parent || !(directory === parent || directory.startsWith(parent + sep))) {
            result.push(directory);
        }
    }
    return result;
}
