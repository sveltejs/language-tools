import { CancellationToken } from 'vscode-languageserver-protocol';
import {
    CodeAction,
    CodeActionContext,
    CodeActionKind,
    CodeLens,
    Location,
    Range,
    Position,
    TextDocumentIdentifier,
    WorkspaceEdit
} from 'vscode-languageserver-types';
import { Document } from '../../lib/documents';
import {
    CodeActionsProvider,
    CodeLensProvider,
    FileReferencesProvider,
    FileRename,
    FindComponentReferencesProvider,
    FindReferencesProvider,
    UpdateImportsProvider
} from '../interfaces';
import { TsApiService } from './TsApiService';
import { LSConfigManager } from '../../ls-config';
import { TsGoComponentReferenceProvider } from './features/FindComponentReferencesProvider';
import { TsGoCodeLensProvider } from './features/CodeLensProvider';
import { TsGoFileReferencesProvider } from './features/FileReferencesProvider';
import { TsGoUpdateImportsProvider } from './features/UpdateImportsProvider';
import { getAddLangTsCodeAction } from './features/AddLangTsCodeAction';

export class TypeScriptGoPlugin
    implements
        CodeActionsProvider,
        CodeLensProvider,
        FindComponentReferencesProvider,
        FindReferencesProvider,
        FileReferencesProvider,
        UpdateImportsProvider
{
    constructor(apiService: TsApiService, configManager: LSConfigManager) {
        const findComponentReferencesProvider = new TsGoComponentReferenceProvider(apiService);
        this.findComponentReferencesProvider = findComponentReferencesProvider;
        this.fileReferencesProvider = new TsGoFileReferencesProvider(apiService);
        this.updateImportsProvider = new TsGoUpdateImportsProvider(apiService);
        this.codelensProvider = new TsGoCodeLensProvider(
            apiService,
            configManager,
            findComponentReferencesProvider
        );
    }

    __name = 'tsgo';

    private readonly findComponentReferencesProvider: FindComponentReferencesProvider;
    private readonly codelensProvider: CodeLensProvider;
    private readonly fileReferencesProvider: FileReferencesProvider;
    private readonly updateImportsProvider: TsGoUpdateImportsProvider;

    /** Edits in Svelte files only (TS7 does the rest), before the rename, see the provider */
    updateImports(fileRename: FileRename): Promise<WorkspaceEdit | null> {
        return this.updateImportsProvider.updateImports(fileRename);
    }

    /** Only the actions TS7 can't offer (it serves the rest itself) */
    getCodeActions(document: Document, _range: Range, context: CodeActionContext): CodeAction[] {
        if (
            context.only &&
            !context.only.some((kind) => CodeActionKind.QuickFix.startsWith(kind))
        ) {
            return [];
        }
        const addLangTs = getAddLangTsCodeAction(document, context);
        return addLangTs ? [addLangTs] : [];
    }

    fileReferences(uri: string): Promise<Location[] | null> {
        return this.fileReferencesProvider.fileReferences(uri);
    }

    async getCodeLens(document: Document): Promise<CodeLens[] | null> {
        return this.codelensProvider.getCodeLens(document);
    }

    async resolveCodeLens(
        textDocument: Document,
        codeLensToResolve: CodeLens,
        cancellationToken?: CancellationToken
    ): Promise<CodeLens> {
        return this.codelensProvider.resolveCodeLens(
            textDocument,
            codeLensToResolve,
            cancellationToken
        );
    }

    findComponentReferences(uri: string): Promise<Location[] | null> {
        return this.findComponentReferencesProvider.findComponentReferences(uri);
    }

    async findReferences(document: Document, position: Position): Promise<Location[] | null> {
        if (this.isScriptStartOrEndTag(position, document)) {
            return this.findComponentReferences(document.uri);
        }

        return null;
    }

    private isScriptStartOrEndTag(position: Position, document: Document) {
        if (!document.scriptInfo) {
            return false;
        }
        const { start, end } = document.scriptInfo.container;

        const offset = document.offsetAt(position);
        return (
            (offset >= start && offset <= start + '<script'.length) ||
            (offset >= end - '</script>'.length && offset <= end)
        );
    }
}
