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
    Hover,
    Position,
    Range,
    SymbolInformation,
    TextDocumentIdentifier,
    TextEdit,
} from 'vscode-languageserver-types';
import { Document } from '../lib/documents';

export type Resolvable<T> = T | Promise<T>;

export interface AppCompletionItem<T extends TextDocumentIdentifier = any> extends CompletionItem {
    data?: T;
}

export interface AppCompletionList<T extends TextDocumentIdentifier = any> extends CompletionList {
    items: AppCompletionItem<T>[];
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
        completionContext?: CompletionContext,
    ): Resolvable<AppCompletionList<T> | null>;

    resolveCompletion?(
        document: Document,
        completionItem: AppCompletionItem<T>,
    ): Resolvable<AppCompletionItem<T>>;
}

export interface FormattingProvider {
    formatDocument(document: Document): Resolvable<TextEdit[]>;
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
        color: Color,
    ): Resolvable<ColorPresentation[]>;
}

export interface DocumentSymbolsProvider {
    getDocumentSymbols(document: Document): Resolvable<SymbolInformation[]>;
}

export interface DefinitionsProvider {
    getDefinitions(document: Document, position: Position): Resolvable<DefinitionLink[]>;
}

export interface CodeActionsProvider {
    getCodeActions(
        document: Document,
        range: Range,
        context: CodeActionContext,
    ): Resolvable<CodeAction[]>;
}

export interface OnWatchFileChanges {
    onWatchFileChanges(fileName: string, changeType: FileChangeType): void;
}

export type LSProvider = DiagnosticsProvider &
    HoverProvider &
    CompletionsProvider &
    FormattingProvider &
    TagCompleteProvider &
    DocumentColorsProvider &
    ColorPresentationsProvider &
    DocumentSymbolsProvider &
    DefinitionsProvider &
    CodeActionsProvider;

export type Plugin = Partial<LSProvider & OnWatchFileChanges>;
