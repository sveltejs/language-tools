import { CancellationToken } from 'vscode-languageserver-protocol';
import { CodeLens, Position } from 'vscode-languageserver-types';
import { Document } from '../../../lib/documents';
import { LSConfigManager } from '../../../ls-config';
import { CodeLensProvider } from '../../interfaces';
import { TsApiService } from '../TsApiService';
import { TsGoComponentReferenceProvider } from './FindComponentReferencesProvider';

export class TsGoCodeLensProvider implements CodeLensProvider {
    private readonly tsApiService: TsApiService;
    private readonly configManager: LSConfigManager;
    private readonly componentReferenceProvider: TsGoComponentReferenceProvider;

    constructor(
        tsApiService: TsApiService,
        configManager: LSConfigManager,
        componentReferenceProvider: TsGoComponentReferenceProvider
    ) {
        this.tsApiService = tsApiService;
        this.configManager = configManager;
        this.componentReferenceProvider = componentReferenceProvider;
    }

    async getCodeLens(document: Document): Promise<CodeLens[] | null> {
        const tsPreference = this.configManager.getClientTsUserConfig('typescript');
        const jsPreference = this.configManager.getClientTsUserConfig('javascript');
        if (
            !tsPreference.referencesCodeLens?.enabled &&
            !jsPreference.referencesCodeLens?.enabled
        ) {
            return null;
        }

        const projectAndTsDoc = await this.tsApiService.getProjectAndTsDoc(document);
        if (!projectAndTsDoc || !projectAndTsDoc.userPreferences.referencesCodeLens?.enabled) {
            return null;
        }

        const range = { start: Position.create(0, 0), end: Position.create(0, 1) };
        return [
            CodeLens.create(range, {
                type: 'reference',
                uri: document.uri
            })
        ];
    }

    async resolveCodeLens(
        textDocument: Document,
        codeLensToResolve: CodeLens,
        cancellationToken?: CancellationToken
    ): Promise<CodeLens> {
        const locations =
            (await this.componentReferenceProvider.findComponentReferencesForCodeLens(
                textDocument.uri,
                cancellationToken
            )) ?? [];

        codeLensToResolve.command = {
            title: locations.length === 1 ? '1 reference' : `${locations.length} references`,
            command: '',
            arguments: [textDocument.uri, codeLensToResolve.range.start, locations]
        };
        return codeLensToResolve;
    }
}
