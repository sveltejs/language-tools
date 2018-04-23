import * as svelte from 'svelte';
import { DiagnosticsProvider, Document, Diagnostic, Range, DiagnosticSeverity } from '../api';

export class SveltePlugin implements DiagnosticsProvider {
    getDiagnostics(document: Document): Diagnostic[] {
        let res;
        try {
            // TODO: pull svelte config from somewhere, e.g. svelte.config.js
            res = svelte.compile(document.getText(), { dev: true });
        } catch (err) {
            const start = err.start || { line: 1, column: 0 };
            const end = err.end || start;
            return [
                {
                    range: Range.create(start.line - 1, start.column, end.line - 1, end.column),
                    message: err.message,
                    severity: DiagnosticSeverity.Error,
                    source: 'svelte',
                    code: err.code,
                },
            ];
        }

        return (res.stats.warnings as svelte.Warning[]).map(warning => {
            const start = warning.start || { line: 1, column: 0 };
            const end = warning.end || start;
            return {
                range: Range.create(start.line - 1, start.column, end.line - 1, end.column),
                message: warning.message,
                severity: DiagnosticSeverity.Warning,
                source: 'svelte',
                code: warning.code,
            };
        });
    }
}
