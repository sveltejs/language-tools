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
    CompletionList,
    TextDocumentItem,
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
    CompletionList,
    TextDocumentItem,
};

export type Resolvable<T> = T | Promise<T>;

export interface DiagnosticsProvider {
    getDiagnostics(document: Document): Resolvable<Diagnostic[]>;
}

export namespace DiagnosticsProvider {
    export function is(obj: any): obj is DiagnosticsProvider {
        return typeof obj.getDiagnostics === 'function';
    }
}

export interface HoverProvider {
    doHover(document: Document, position: Position): Resolvable<Hover | null>;
}

export namespace HoverProvider {
    export function is(obj: any): obj is HoverProvider {
        return typeof obj.doHover === 'function';
    }
}

export interface CompletionsProvider {
    getCompletions(document: Document, position: Position): Resolvable<CompletionItem[]>;
}

export namespace CompletionsProvider {
    export function is(obj: any): obj is CompletionsProvider {
        return typeof obj.getCompletions === 'function';
    }
}

export interface FormattingProvider {
    formatDocument(document: Document): Resolvable<TextEdit[]>;
}

export namespace FormattingProvider {
    export function is(obj: any): obj is FormattingProvider {
        return typeof obj.formatDocument === 'function';
    }
}

export interface TagCompleteProvider {
    doTagComplete(document: Document, positon: Position): Resolvable<string | null>;
}

export namespace TagCompleteProvider {
    export function is(obj: any): obj is TagCompleteProvider {
        return typeof obj.doTagComplete === 'function';
    }
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
    container?: {
        start: number;
        end: number;
    };
    attributes: Record<string, string>;
}

export type FragmentPredicate = (fragment: Fragment) => boolean;
