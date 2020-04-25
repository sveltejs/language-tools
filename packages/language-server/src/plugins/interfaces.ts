import {
    CodeAction,
    CodeActionContext,
    Color,
    ColorInformation,
    ColorPresentation,
    CompletionList,
    DefinitionLink,
    Diagnostic,
    Hover,
    Position,
    Range,
    SymbolInformation,
    TextEdit,
} from 'vscode-languageserver-types';
import { FileChangeType } from 'vscode-languageserver'
import { DocumentManager, Document } from '../lib/documents';
import { LSConfigManager } from '../ls-config';

export type Resolvable<T> = T | Promise<T>;

export interface DiagnosticsProvider {
    getDiagnostics(document: Document): Resolvable<Diagnostic[]>;
}

export interface HoverProvider {
    doHover(document: Document, position: Position): Resolvable<Hover | null>;
}

export interface CompletionsProvider {
    getCompletions(
        document: Document,
        position: Position,
        triggerCharacter?: string,
    ): Resolvable<CompletionList | null>;
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

export interface OnRegister {
    onRegister(documentsManager: DocumentManager, config: LSConfigManager): void;
}

export interface OnWatchFileChanges {
    onWatchFileChanges(fileName: string, changeType: FileChangeType): void
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

export type Plugin = Partial<LSProvider & OnWatchFileChanges> & OnRegister;
