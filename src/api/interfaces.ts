import {
    Diagnostic,
    DiagnosticSeverity,
    Position,
    Range,
    Hover,
    MarkupContent,
    MarkedString,
    CompletionItem,
    CompletionItemKind,
    TextEdit,
    InsertTextFormat,
    Command,
} from 'vscode-languageserver-types';
import { Document } from './Document';

export {
    Diagnostic,
    DiagnosticSeverity,
    Position,
    Range,
    Hover,
    MarkupContent,
    MarkedString,
    CompletionItem,
    CompletionItemKind,
    TextEdit,
    InsertTextFormat,
    Command,
};

export type Resolvable<T> = T | Promise<T>;

export interface DiagnosticsProvider {
    getDiagnostics(document: Document): Resolvable<Diagnostic[]>;
}

export interface HoverProvider {
    doHover(document: Document, position: Position): Resolvable<Hover | null>;
}

export interface CompletionsProvider {
    getCompletions(document: Document, position: Position): Resolvable<CompletionItem[]>;
}

export interface Fragment extends Document {
    details: FragmentDetails;

    /**
     * Get the fragment offset relative to the parent
     * @param offset Offset in fragment
     */
    offsetInParent(offset: number): number;

    /**
     * Get the fragment position relative to the parent
     * @param pos Position in fragment
     */
    positionInParent(pos: Position): Position;

    /**
     * Get the offset relative to the start of the fragment
     * @param offset Offset in parent
     */
    offsetInFragment(offset: number): number;

    /**
     * Get the position relative to the start of the fragment
     * @param pos Position in parent
     */
    positionInFragment(pos: Position): Position;

    /**
     * Returns true if the given parent position is inside of this fragment
     * @param pos Position in parent
     */
    isInFragment(pos: Position): boolean;
}

export interface FragmentDetails {
    start: number;
    end: number;
    attributes: Record<string, string>;
}
