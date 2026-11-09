import { readFileSync } from 'fs';
import { fdir } from 'fdir';
import { dirname, isAbsolute } from 'path';
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
import { Ts7Project, TypeScript7Modules } from './project';

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

/** TS `DiagnosticCategory.Error` */
const ERROR_CATEGORY = 1;

/**
 * svelte-check on TypeScript 7: TypeScript diagnostics come from TS7 through its API, with
 * `.svelte` files transformed by the content mapper (`@sveltejs/ts-content-mapper`) configured in
 * the tsconfig. Svelte compiler and CSS diagnostics come from the Svelte and CSS plugins, like in
 * `SvelteCheck`.
 *
 * Reports the same files as `SvelteCheck` with a tsconfig (the program's files, see `files.ts`),
 * in the same shape. This module doesn't load TypeScript 6. svelte2tsx (and with it TS6) is only
 * loaded on demand, see `postprocess.ts`.
 */
export class SvelteCheckTs7 {
    private readonly docManager = new DocumentManager(
        (textDocument) => new Document(textDocument.uri, textDocument.text)
    );
    private readonly configManager = new LSConfigManager();
    private readonly pluginHost = new PluginHost(this.docManager);
    private readonly sources: ReadonlySet<SvelteCheckDiagnosticSource>;
    /** Svelte compiler and CSS diagnostics per (normalized) file path */
    private readonly svelteDiagnostics = new Map<string, Promise<Diagnostic[]>>();
    /** Once the program is known: the Svelte files that are worth checking */
    private svelteFilesToCheck: Set<string> | undefined;

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

        configLoader.setExplicitConfigScope(
            options.configPath
                ? { configPath: options.configPath, rootDirectory: dirname(options.tsconfig) }
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
        const tsconfigDirectory = dirname(this.options.tsconfig);
        const opening = Ts7Project.open(
            this.options.typescript,
            this.options.tsconfig,
            tsconfigDirectory
        );
        // Building the program takes a while (the content mapper transforms every Svelte file).
        // Meanwhile, check the Svelte files below the tsconfig, most of them are in the program.
        const early = findSvelteFiles(tsconfigDirectory)
            .then((files) => this.runSvelteDiagnostics(files))
            .catch(() => {});

        let project: Ts7Project;
        try {
            project = await opening;
        } catch (error) {
            this.svelteFilesToCheck = new Set();
            throw error;
        }
        try {
            return await this.check(project);
        } finally {
            this.svelteFilesToCheck = new Set();
            await early;
            await project.close();
        }
    }

    private async check(project: Ts7Project): Promise<SvelteCheckFileDiagnostics[]> {
        const tsconfig = this.options.tsconfig;
        if (!hasSvelteContentMapper(project.rawConfig)) {
            throw missingContentMapperError(tsconfig);
        }

        const { config, program } = await project.getProjectDiagnostics();
        const projectFailures = [...config, ...program].filter(isContentMapperFailure);
        if (projectFailures.length) {
            // TS7 reports failed transforms per file, the failure message names them
            const svelteFiles = (await project.getSourceFileNames()).filter(isSvelteFile);
            const fileDiagnostics = await project
                .getFileDiagnostics(svelteFiles)
                .catch(() => new Map<string, ApiDiagnostic[]>());
            throwIfContentMapperFailed(
                [...projectFailures, ...[...fileDiagnostics.values()].flat()],
                dirname(tsconfig)
            );
        }
        const configErrors = config.filter((diagnostic) => diagnostic.category === ERROR_CATEGORY);
        if (configErrors.length) {
            // like TS6 svelte-check: a broken config makes everything else noise
            return this.reportProjectDiagnostics(configErrors);
        }

        const fileNames = await project.getSourceFileNames();
        const filesToCheck = fileNames.filter((fileName) =>
            shouldCheckFile(fileName, project.compilerOptions)
        );
        const svelteFiles = filesToCheck.filter(isSvelteFile);
        this.svelteFilesToCheck = new Set(svelteFiles.map(normalizePath));

        const typeScriptDiagnostics = this.sources.has('js')
            ? project.getFileDiagnostics(filesToCheck)
            : Promise.resolve(new Map<string, ApiDiagnostic[]>());
        // the Svelte files that weren't checked yet, while TypeScript checks
        await this.runSvelteDiagnostics(svelteFiles);
        const diagnosticsByFile = await typeScriptDiagnostics;
        throwIfContentMapperFailed([...diagnosticsByFile.values()].flat(), dirname(tsconfig));

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
    private async runSvelteDiagnostics(files: readonly string[]): Promise<void> {
        if (!this.sources.has('svelte') && !this.sources.has('css')) {
            return;
        }
        for (const file of files) {
            const key = normalizePath(file);
            if (
                this.svelteDiagnostics.has(key) ||
                (this.svelteFilesToCheck && !this.svelteFilesToCheck.has(key))
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
