import {
    Diagnostic,
    DiagnosticSeverity,
    Position,
    Range,
    Hover,
    MarkupContent,
    MarkedString,
} from 'vscode-languageserver-types';
import { Document } from './Document';

export { Diagnostic, DiagnosticSeverity, Position, Range, Hover, MarkupContent, MarkedString };

export type Resolvable<T> = T | Promise<T>;

export interface DiagnosticsProvider {
    getDiagnostics(document: Document): Resolvable<Diagnostic[]>;
}

export interface HoverProvider {
    doHover(document: Document, position: Position): Resolvable<Hover | null>;
}
