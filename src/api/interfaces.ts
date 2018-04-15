import { Diagnostic, DiagnosticSeverity, Position, Range } from 'vscode-languageserver-types';
import { Document } from './Document';

export type Resolvable<T> = T | Promise<T>;

export interface DiagnosticsProvider {
    getDiagnostics(document: Document): Resolvable<Diagnostic[]>;
}

export { Diagnostic, DiagnosticSeverity, Position, Range };
