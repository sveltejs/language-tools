import { Logger } from '../../logger';
import { LSConfigManager, TSUserConfig } from '../../ls-config';
import type { tsApiAsync, tsAst } from './types';

interface TsModules {
    tsApiAsync: typeof tsApiAsync;
    tsAst: typeof tsAst;
}

/**
 * What the virtual-code diagnostics need from the TS7 API: the language server's connection
 * (`TsApiService`) or svelte-check's own API session (`svelte-check-ts7`).
 */
export type TsApiAccess = Pick<TsApiService, 'astModule' | 'withSourceFile'>;

/**
 * Connection to the TS7 language server's own project state (`API.fromLSPConnection`), for the
 * Svelte-specific features that LSP requests and the middleware can't cover.
 *
 * Positions in the API are offsets of the code TS7 sees: the virtual code (svelte2tsx output) for
 * `.svelte` files. `TsApiLocationMapper` maps them to the original file.
 */
export class TsApiService {
    private readonly tsApi: tsApiAsync.API<true>;
    readonly astModule: typeof tsAst;
    readonly apiModule: typeof tsApiAsync;
    private readonly configManager: LSConfigManager;

    private constructor(
        modules: TsModules,
        configManager: LSConfigManager,
        api: tsApiAsync.API<true>
    ) {
        this.tsApi = api;
        this.astModule = modules.tsAst;
        this.apiModule = modules.tsApiAsync;
        this.configManager = configManager;
    }

    static async create(
        options: { apiPipe?: string; typescriptPackageJsonPath?: string | undefined },
        configManager: LSConfigManager
    ): Promise<TsApiService | null> {
        if (!options?.apiPipe) {
            return null;
        }

        try {
            const tsVsCode = await import('@typescript/native/vscode');

            let modules: TsModules;
            if (options.typescriptPackageJsonPath) {
                const loader = tsVsCode.createTypeScriptModuleLoader(
                    options.typescriptPackageJsonPath
                );
                const tsApiAsync = await loader.importModule('typescript/async');
                const tsAst = await loader.importModule('typescript/ast');
                modules = { tsApiAsync, tsAst };
            } else {
                const tsApiAsync = await import('@typescript/native/async');
                const tsAst = await import('@typescript/native/ast');
                modules = { tsApiAsync, tsAst };
            }

            const api = await modules.tsApiAsync.API.fromLSPConnection({ pipe: options.apiPipe });
            return new TsApiService(modules, configManager, api);
        } catch (error) {
            Logger.error('Failed to create TsApiService', error);
            return null;
        }
    }

    /**
     * Runs `fn` against the default project of `uri` in the language server's current snapshot.
     *
     * Every `getCurrentLanguageServerSnapshot` call creates a new snapshot that stays alive on both
     * sides until it's disposed, so the snapshot is released when `fn` settles. Nodes, symbols and
     * handles obtained in `fn` belong to that snapshot and must not be used afterwards.
     */
    async withProject<T>(
        uri: string,
        fn: (project: tsApiAsync.Project) => Promise<T>
    ): Promise<T | undefined> {
        const snapshot = await this.tsApi.getCurrentLanguageServerSnapshot();
        try {
            const project = await snapshot.getDefaultProjectForFile({ uri });
            return project ? await fn(project) : undefined;
        } finally {
            snapshot
                .dispose()
                .catch((error) => Logger.error('Failed to release TypeScript snapshot', error));
        }
    }

    /** Like `withProject`, with the source file of `uri` (virtual code for Svelte files) */
    async withSourceFile<T>(
        uri: string,
        fn: (project: tsApiAsync.Project, sourceFile: tsAst.SourceFile) => Promise<T>
    ): Promise<T | undefined> {
        return this.withProject(uri, async (project) => {
            const sourceFile = await project.program.getSourceFile({ uri });
            return sourceFile ? await fn(project, sourceFile) : undefined;
        });
    }

    async dispose(): Promise<void> {
        await this.tsApi.close();
    }

    getUserPreferences(sourceFile: tsAst.SourceFile): TSUserConfig {
        return this.configManager.getClientTsUserConfig(
            sourceFile.scriptKind == this.astModule.ScriptKind.TS ? 'typescript' : 'javascript'
        );
    }
}
