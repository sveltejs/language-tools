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
import type { tsApiAsync } from '../plugins/typescript-go/types';
import type { SvelteCheckDiagnosticSource } from '../svelte-check';
import { normalizePath, pathToUrl } from '../utils';
import { ApiDiagnostic, getSvelteFileSource, toFileDiagnostic } from './convert';
import { isSvelteFile, shouldCheckFile } from './files';
import {
    hasSvelteContentMapper,
    isContentMapperFailure,
    missingContentMapperError,
    throwIfContentMapperFailed
} from './infrastructure';
import { postProcessSvelteDiagnostics } from './postprocess';
import { FileNotifications, Ts7Project, TypeScript7Modules } from './project';

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

/** TS `DiagnosticCategory.Error` */
const ERROR_CATEGORY = 1;

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
 * in the same shape. This module doesn't load TypeScript 6. svelte2tsx (and with it TS6) is only
 * loaded on demand, see `postprocess.ts`.
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
     * Watch mode: the directories to watch for changes. The tsconfig's directory and the
     * directories of the program's files outside `node_modules` (like the TypeScript 6 path).
     */
    getWatchDirectories(): string[] {
        const directories = [
            this.tsconfigDirectory,
            ...this.programFiles
                .filter(
                    (fileName) =>
                        shouldCheckFile(fileName) && !/[\\/]node_modules[\\/]/.test(fileName)
                )
                .map((fileName) => dirname(fileName))
        ];
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
        const tsconfig = this.options.tsconfig;
        if (!hasSvelteContentMapper(project.rawConfig)) {
            throw missingContentMapperError(tsconfig);
        }

        const fileNames = await project.getSourceFileNames();
        this.programFiles = fileNames;
        const filesToCheck = fileNames.filter(shouldCheckFile);
        const svelteFiles = filesToCheck.filter(isSvelteFile);
        run.svelteFilesToCheck = new Set(svelteFiles.map(normalizePath));
        for (const file of this.svelteDiagnostics.keys()) {
            if (!run.svelteFilesToCheck.has(file)) {
                this.svelteDiagnostics.delete(file);
            }
        }

        const typeScriptDiagnostics = project.getDiagnostics(filesToCheck, this.sources.has('js'));
        // awaited below, after the Svelte files
        typeScriptDiagnostics.catch(() => {});
        // the Svelte files that weren't checked yet, while TypeScript checks
        await this.runSvelteDiagnostics(svelteFiles, run);
        const { config, program, files: diagnosticsByFile } = await typeScriptDiagnostics;

        const fileDiagnostics = [...diagnosticsByFile.values()].flat();
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

        const checked = new Set(filesToCheck);
        const result: SvelteCheckFileDiagnostics[] = [];
        for (const fileName of fileNames) {
            const diagnostics = diagnosticsByFile.get(fileName) ?? [];
            if (!checked.has(fileName)) {
                result.push({ filePath: fileName, text: '', diagnostics: [] });
            } else if (isSvelteFile(fileName)) {
                result.push(await this.getSvelteFileDiagnostics(project, fileName, diagnostics));
            } else {
                result.push({
                    filePath: fileName,
                    text: diagnostics.length ? readFileSync(fileName, 'utf-8') : '',
                    diagnostics: diagnostics.map(toFileDiagnostic)
                });
            }
        }

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

    private async getSvelteFileDiagnostics(
        project: Ts7Project,
        filePath: string,
        typeScriptDiagnostics: ApiDiagnostic[]
    ): Promise<SvelteCheckFileDiagnostics> {
        const svelteDiagnostics = (await this.svelteDiagnostics.get(normalizePath(filePath))) ?? [];
        const document = this.getDocument(filePath);
        const diagnostics = typeScriptDiagnostics.length
            ? await postProcessSvelteDiagnostics(document, typeScriptDiagnostics, project, {
                  source: getSvelteFileSource(document),
                  keepMapperDiagnostics: !this.sources.has('svelte')
              })
            : [];
        return {
            filePath,
            text: document.getText(),
            diagnostics: [...svelteDiagnostics, ...diagnostics]
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
