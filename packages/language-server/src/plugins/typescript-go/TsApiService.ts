import { Document } from '../../lib/documents';
import { Logger } from '../../logger';
import { LSConfigManager, TSUserConfig } from '../../ls-config';
import type { tsApiAsync, tsAst } from './types';

interface TsModules {
    tsApiAsync: typeof tsApiAsync;
    tsAst: typeof tsAst;
}

export class TsApiService {
    private readonly tsApi: tsApiAsync.API<true>;
    astModule: typeof tsAst;
    private readonly configManager: LSConfigManager;

    private constructor(
        modules: TsModules,
        configManager: LSConfigManager,
        api: tsApiAsync.API<true>
    ) {
        this.tsApi = api;
        this.astModule = modules.tsAst;
        this.configManager = configManager;
    }

    static async create(
        options: { apiPipe: string; typescriptPackageJsonPath: string | undefined },
        configManager: LSConfigManager
    ): Promise<TsApiService | null> {
        if (!options.apiPipe) {
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

    async getProject(uri: string): Promise<tsApiAsync.Project | undefined> {
        const snapshot = await this.tsApi.getCurrentLanguageServerSnapshot();
        return snapshot.getDefaultProjectForFile({ uri });
    }

    async getProjectAndTsDoc(document: Document): Promise<
        | {
              project: tsApiAsync.Project;
              userPreferences: TSUserConfig;
              sourceFile: tsAst.SourceFile;
          }
        | undefined
    > {
        const uri = document.uri;
        const project = await this.getProject(uri);
        if (!project) {
            return undefined;
        }

        const sourceFile = await project?.program.getSourceFile({ uri });
        if (!sourceFile) {
            return undefined;
        }

        return {
            project,
            userPreferences: this.configManager.getClientTsUserConfig(
                sourceFile.scriptKind == this.astModule.ScriptKind.TS ? 'typescript' : 'javascript'
            ),
            sourceFile: sourceFile
        };
    }
}
