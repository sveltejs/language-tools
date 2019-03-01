import cosmic from 'cosmiconfig';
import {
    DiagnosticsProvider,
    Document,
    Diagnostic,
    Range,
    DiagnosticSeverity,
    Fragment,
    Position,
    Host,
} from '../api';
import { SvelteDocument } from '../lib/documents/SvelteDocument';
import { RawSourceMap, RawIndexMap, SourceMapConsumer } from 'source-map';
import { PreprocessOptions, CompileOptions, Warning } from 'svelte/compiler';
import { loadSvelte } from './svelte/loadSvelte';

interface SvelteConfig extends CompileOptions {
    preprocess?: PreprocessOptions;
}

const DEFAULT_OPTIONS: CompileOptions = {
    dev: true,
};

export class SveltePlugin implements DiagnosticsProvider {
    public pluginId = 'svelte';
    public defaultConfig = {
        enable: true,
        diagnostics: { enable: true },
    };

    private host!: Host;

    onRegister(host: Host) {
        this.host = host;
    }

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (!this.host.getConfig<boolean>('svelte.diagnostics.enable')) {
            return [];
        }

        let source = document.getText();

        const config = await this.loadConfig(document.getFilePath()!);
        const svelte = loadSvelte(document.getFilePath()!) as any;

        const preprocessor = makePreprocessor(document as SvelteDocument, config.preprocess);
        source = (await svelte.preprocess(source, preprocessor)).toString();
        preprocessor.transpiledDocument.setText(source);

        let diagnostics: Diagnostic[];
        try {
            delete config.preprocess;
            const res = svelte.compile(source, config);

            diagnostics = ((res.stats.warnings || res.warnings || []) as Warning[]).map(warning => {
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

        await fixDiagnostics(document, preprocessor, diagnostics);
        return diagnostics;
    }

    private async loadConfig(path: string): Promise<SvelteConfig> {
        try {
            const { config } = await cosmic('svelte', {
                packageProp: false,
            }).load(path);
            return { ...DEFAULT_OPTIONS, ...config };
        } catch (err) {
            return { ...DEFAULT_OPTIONS, preprocess: {} };
        }
    }
}

interface Preprocessor extends PreprocessOptions {
    fragments: {
        source: Fragment;
        transpiled: Fragment;
        code: string;
        map: RawSourceMap | RawIndexMap | string;
    }[];
    transpiledDocument: SvelteDocument;
}

function makePreprocessor(document: SvelteDocument, preprocessors: PreprocessOptions = {}) {
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
    document: Document,
    preprocessor: Preprocessor,
    diagnostics: Diagnostic[],
): Promise<void> {
    for (const fragment of preprocessor.fragments) {
        const newDiagnostics: Diagnostic[] = [];
        const fragmentDiagnostics: Diagnostic[] = [];
        for (let diag of diagnostics) {
            if (fragment.transpiled.isInFragment(diag.range.start)) {
                fragmentDiagnostics.push(diag);
            } else {
                newDiagnostics.push(diag);
            }
        }
        diagnostics = newDiagnostics;
        if (fragmentDiagnostics.length === 0) {
            continue;
        }

        await SourceMapConsumer.with(fragment.map, null, consumer => {
            for (const diag of fragmentDiagnostics) {
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
            }
        });
    }

    const sortedFragments = preprocessor.fragments.sort(
        (a, b) => a.transpiled.offsetInParent(0) - b.transpiled.offsetInParent(0),
    );
    if (diagnostics.length > 0) {
        for (const diag of diagnostics) {
            for (const fragment of sortedFragments) {
                const start = preprocessor.transpiledDocument.offsetAt(diag.range.start);
                if (fragment.transpiled.details.container!.end > start) {
                    continue;
                }

                const sourceLength =
                    fragment.source.details.container!.end -
                    fragment.source.details.container!.start;
                const transpiledLength =
                    fragment.transpiled.details.container!.end -
                    fragment.transpiled.details.container!.start;
                const diff = sourceLength - transpiledLength;
                const end = preprocessor.transpiledDocument.offsetAt(diag.range.end);
                diag.range = {
                    start: document.positionAt(start + diff),
                    end: document.positionAt(end + diff),
                };
            }
        }
    }
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
