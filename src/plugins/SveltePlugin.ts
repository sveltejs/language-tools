import * as svelte from 'svelte';
import cosmic from 'cosmiconfig';
import {
    DiagnosticsProvider,
    Document,
    Diagnostic,
    Range,
    DiagnosticSeverity,
    Fragment,
    Position,
} from '../api';
import { SvelteDocument } from '../lib/documents/SvelteDocument';
import { RawSourceMap, RawIndexMap, SourceMapConsumer } from 'source-map';

interface SvelteConfig extends svelte.CompileOptions {
    preprocess?: svelte.PreprocessOptions;
}

const DEFAULT_OPTIONS: svelte.CompileOptions = {
    dev: true,
};

export class SveltePlugin implements DiagnosticsProvider {
    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        let source = document.getText();

        const config = await this.loadConfig(document.getFilePath()!);
        const preprocessor = makePreprocessor(document as SvelteDocument, config.preprocess);
        source = (await svelte.preprocess(source, preprocessor)).toString();
        preprocessor.transpiledDocument.setText(source);

        let diagnostics: Diagnostic[];
        try {
            const res = svelte.compile(source, config);

            diagnostics = (res.stats.warnings as svelte.Warning[]).map(warning => {
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
        } catch (err) {
            const start = err.start || { line: 1, column: 0 };
            const end = err.end || start;
            diagnostics = [
                {
                    range: Range.create(start.line - 1, start.column, end.line - 1, end.column),
                    message: err.message,
                    severity: DiagnosticSeverity.Error,
                    source: 'svelte',
                    code: err.code,
                },
            ];
        }

        return await fixDiagnostics(preprocessor, diagnostics);
    }

    private async loadConfig(path: string): Promise<SvelteConfig> {
        try {
            const { config } = await cosmic('svelte').load(path);
            console.log('using config', config);
            return { ...DEFAULT_OPTIONS, ...config };
        } catch (err) {
            return { ...DEFAULT_OPTIONS, preprocess: {} };
        }
    }
}

interface Preprocessor extends svelte.PreprocessOptions {
    fragments: {
        source: Fragment;
        transpiled: Fragment;
        code: string;
        map: RawSourceMap | RawIndexMap | string;
    }[];
    transpiledDocument: SvelteDocument;
}

function makePreprocessor(document: SvelteDocument, preprocessors: svelte.PreprocessOptions = {}) {
    const preprocessor: Preprocessor = {
        fragments: [],
        transpiledDocument: new SvelteDocument(document.getURL(), document.getText()),
    };

    if (preprocessors.script) {
        preprocessor.script = async args => {
            const res = await preprocessors.script!(args);
            if (res && res.map) {
                preprocessor.fragments.push({
                    source: document.script,
                    transpiled: preprocessor.transpiledDocument.script,
                    code: res.code,
                    map: res.map,
                });
            }
            return res;
        };
    }

    if (preprocessors.style) {
        preprocessor.style = async args => {
            const res = await preprocessors.style!(args);
            if (res && res.map) {
                preprocessor.fragments.push({
                    source: document.style,
                    transpiled: preprocessor.transpiledDocument.style,
                    code: res.code,
                    map: res.map,
                });
            }
            return res;
        };
    }

    return preprocessor;
}

async function fixDiagnostics(
    preprocessor: Preprocessor,
    diagnostics: Diagnostic[],
): Promise<Diagnostic[]> {
    for (const fragment of preprocessor.fragments) {
        const fragmentDiagnostics = diagnostics.filter(diag =>
            fragment.transpiled.isInFragment(diag.range.start),
        );
        console.log('translating', fragmentDiagnostics);
        if (fragmentDiagnostics.length === 0) {
            continue;
        }

        await SourceMapConsumer.with(fragment.map, null, consumer => {
            for (const diag of fragmentDiagnostics) {
                console.log('before', diag.range);
                diag.range = {
                    start: mapFragmentPositionBySourceMap(
                        fragment.source,
                        fragment.transpiled,
                        consumer,
                        diag.range.start,
                    ),
                    end: mapFragmentPositionBySourceMap(
                        fragment.source,
                        fragment.transpiled,
                        consumer,
                        diag.range.end,
                    ),
                };
                console.log('after', diag.range);
            }
        });
    }
    return diagnostics;
    // return diagnostics.map(diagnostic => {
    //     const fragment = document.getFragmentAt(diagnostic.range.start);
    //     if (!fragment) {
    //         return diagnostic;
    //     }

    //     return { ...diagnostic };
    // });
}

function mapFragmentPositionBySourceMap(
    source: Fragment,
    transpiled: Fragment,
    consumer: SourceMapConsumer,
    pos: Position,
): Position {
    // Start with a position that exists in the transpiled fragment's parent

    // Map the position to be relative to the transpiled fragment only
    const transpiledPosition = transpiled.positionInFragment(pos);

    // Map the position, using the sourcemap, to a position in the source fragment
    const mappedPosition = consumer.originalPositionFor({
        line: transpiledPosition.line + 1,
        column: transpiledPosition.character,
    });
    const sourcePosition = {
        line: mappedPosition.line! - 1,
        character: mappedPosition.column!,
    };

    // Map the position to be relative to the source fragment's parent
    return source.positionInParent(sourcePosition);
}
