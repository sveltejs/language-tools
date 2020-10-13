import { CompletionContext, FileChangeType } from 'vscode-languageserver';
import {
    CodeAction,
    CodeActionContext,
    Color,
    ColorInformation,
    ColorPresentation,
    CompletionItem,
    CompletionList,
    DefinitionLink,
    Diagnostic,
    FormattingOptions,
    Hover,
    Location,
    Position,
    Range,
    ReferenceContext,
    SymbolInformation,
    TextDocumentIdentifier,
    TextEdit,
    WorkspaceEdit
} from 'vscode-languageserver-types';
import { Document } from '../lib/documents';

export type Resolvable<T> = T | Promise<T>;

export interface AppCompletionItem<T extends TextDocumentIdentifier = any> extends CompletionItem {
    data?: T;
}

export interface AppCompletionList<T extends TextDocumentIdentifier = any> extends CompletionList {
    items: Array<AppCompletionItem<T>>;
}

export interface DiagnosticsProvider {
    getDiagnostics(document: Document): Resolvable<Diagnostic[]>;
}

export interface HoverProvider {
    doHover(document: Document, position: Position): Resolvable<Hover | null>;
}

export interface CompletionsProvider<T extends TextDocumentIdentifier = any> {
    getCompletions(
        document: Document,
        position: Position,
        completionContext?: CompletionContext
    ): Resolvable<AppCompletionList<T> | null>;

    resolveCompletion?(
        document: Document,
        completionItem: AppCompletionItem<T>
    ): Resolvable<AppCompletionItem<T>>;
}

export interface FormattingProvider {
    formatDocument(document: Document, options: FormattingOptions): Resolvable<TextEdit[]>;
}

export interface TagCompleteProvider {
    doTagComplete(document: Document, positon: Position): Resolvable<string | null>;
}

export interface DocumentColorsProvider {
    getDocumentColors(document: Document): Resolvable<ColorInformation[]>;
}

export interface ColorPresentationsProvider {
    getColorPresentations(
        document: Document,
        range: Range,
        color: Color
    ): Resolvable<ColorPresentation[]>;
}

export interface DocumentSymbolsProvider {
    getDocumentSymbols(document: Document): Resolvable<SymbolInformation[]>;
}

export interface DefinitionsProvider {
    getDefinitions(document: Document, position: Position): Resolvable<DefinitionLink[]>;
}

export interface BackwardsCompatibleDefinitionsProvider {
    getDefinitions(
        document: Document,
        position: Position
    ): Resolvable<DefinitionLink[] | Location[]>;
}

export interface CodeActionsProvider {
    getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext
    ): Resolvable<CodeAction[]>;
    executeCommand?(
        document: Document,
        command: string,
        args?: any[]
    ): Resolvable<WorkspaceEdit | string | null>;
}

export interface FileRename {
    oldUri: string;
    newUri: string;
}

export interface UpdateImportsProvider {
    updateImports(fileRename: FileRename): Resolvable<WorkspaceEdit | null>;
}

export interface RenameProvider {
    rename(
        document: Document,
        position: Position,
        newName: string
    ): Resolvable<WorkspaceEdit | null>;
    prepareRename(document: Document, position: Position): Resolvable<Range | null>;
}

export interface FindReferencesProvider {
    findReferences(
        document: Document,
        position: Position,
        context: ReferenceContext
    ): Promise<Location[] | null>;
}

export interface OnWatchFileChanges {
    onWatchFileChanges(fileName: string, changeType: FileChangeType): void;
}

type ProviderBase = DiagnosticsProvider &
    HoverProvider &
    CompletionsProvider &
    FormattingProvider &
    TagCompleteProvider &
    DocumentColorsProvider &
    ColorPresentationsProvider &
    DocumentSymbolsProvider &
    UpdateImportsProvider &
    CodeActionsProvider &
    FindReferencesProvider &
    RenameProvider;

export type LSProvider = ProviderBase & BackwardsCompatibleDefinitionsProvider;

export interface LSPProviderConfig {
    /**
     * Whether or not completion lists that are marked as imcomplete
     * should be filtered server side.
     */
    filterIncompleteCompletions: boolean;
    /**
     * Whether or not getDefinitions supports the LocationLink interface.
     */
    definitionLinkSupport: boolean;
}

export type Plugin = Partial<ProviderBase & DefinitionsProvider & OnWatchFileChanges>;
