// TODO: Remove
type InitialMigrationAny = any;

import { cosmiconfig } from 'cosmiconfig';
import { RawIndexMap, RawSourceMap, SourceMapConsumer } from 'source-map';
import { CompileOptions, Warning } from 'svelte/types/compiler/interfaces';
import { PreprocessorGroup } from 'svelte/types/compiler/preprocess';
import {
    CompletionList,
    Diagnostic,
    DiagnosticSeverity,
    Position,
    Range,
    TextEdit,
    Hover,
} from 'vscode-languageserver';
import { Document, ReadableDocument } from '../../lib/documents';
import { LSConfigManager, LSSvelteConfig } from '../../ls-config';
import {
    CompletionsProvider,
    DiagnosticsProvider,
    FormattingProvider,
    Resolvable,
    HoverProvider,
} from '../interfaces';
import { getCompletions } from './features/getCompletions';
import { SvelteDocument, SvelteFragment } from './SvelteDocument';
import { importSvelte, importPrettier } from '../importPackage';
import { getHoverInfo } from './features/getHoverInfo';

interface SvelteConfig extends CompileOptions {
    preprocess?: PreprocessorGroup;
}

const DEFAULT_OPTIONS: CompileOptions = {
    dev: true,
};

export class SveltePlugin
    implements DiagnosticsProvider, FormattingProvider, CompletionsProvider, HoverProvider {
    constructor(private configManager: LSConfigManager) {}

    async getDiagnostics(document: Document): Promise<Diagnostic[]> {
        if (!this.featureEnabled('diagnostics')) {
            return [];
        }

        const svelteDoc = new SvelteDocument(document.getURL(), document.getText());
        let source = svelteDoc.getText();

        const config = await this.loadConfig(svelteDoc.getFilePath()!);
        const svelte = importSvelte(svelteDoc.getFilePath()!);

        const preprocessor = makePreprocessor(svelteDoc, config.preprocess);
        source = (
            await svelte.preprocess(source, preprocessor, {
                filename: svelteDoc.getFilePath()!,
            })
        ).toString();
        preprocessor.transpiledDocument.setText(source);

        let diagnostics: Diagnostic[];
        try {
            delete config.preprocess;
            const res = svelte.compile(source, config);

            diagnostics = (((res.stats as any).warnings || res.warnings || []) as Warning[]).map(
                (warning) => {
                    const start = warning.start || { line: 1, column: 0 };
                    const end = warning.end || start;
                    return {
                        range: Range.create(start.line - 1, start.column, end.line - 1, end.column),
                        message: warning.message,
                        severity: DiagnosticSeverity.Warning,
                        source: 'svelte',
                        code: warning.code,
                    };
                },
            );
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

        await fixDiagnostics(svelteDoc, preprocessor, diagnostics);
        return diagnostics;
    }

    private async loadConfig(path: string): Promise<SvelteConfig> {
        try {
            const explorer = cosmiconfig('svelte', { packageProp: 'svelte-ls' });
            const result = await explorer.search(path);
            const config = result?.config ?? {};
            return { ...DEFAULT_OPTIONS, ...config };
        } catch (err) {
            return { ...DEFAULT_OPTIONS, preprocess: {} };
        }
    }

    async formatDocument(document: Document): Promise<TextEdit[]> {
        if (!this.featureEnabled('format')) {
            return [];
        }

        const filePath = document.getFilePath()!;
        const prettier = importPrettier(filePath);
        const config = await prettier.resolveConfig(filePath);
        const formattedCode = prettier.format(document.getText(), {
            ...config,
            plugins: [require.resolve('prettier-plugin-svelte')],
            parser: 'svelte' as any,
        });

        return [
            TextEdit.replace(
                Range.create(document.positionAt(0), document.positionAt(document.getTextLength())),
                formattedCode,
            ),
        ];
    }

    getCompletions(document: Document, position: Position): Resolvable<CompletionList | null> {
        if (!this.featureEnabled('completions')) {
            return null;
        }

        const svelteDoc = new SvelteDocument(document.getURL(), document.getText());
        return getCompletions(svelteDoc, position);
    }

    doHover(document: Document, position: Position): Hover | null {
        if (!this.featureEnabled('hover')) {
            return null;
        }

        const svelteDoc = new SvelteDocument(document.getURL(), document.getText());
        return getHoverInfo(svelteDoc, position);
    }

    private featureEnabled(feature: keyof LSSvelteConfig) {
        return (
            this.configManager.enabled('svelte.enable') &&
            this.configManager.enabled(`svelte.${feature}.enable`)
        );
    }
}

interface Preprocessor extends PreprocessorGroup {
    fragments: {
        source: SvelteFragment;
        transpiled: SvelteFragment;
        code: string;
        map: RawSourceMap | RawIndexMap | string;
    }[];
    transpiledDocument: SvelteDocument;
}

function makePreprocessor(document: SvelteDocument, preprocessors: PreprocessorGroup = {}) {
    const preprocessor: Preprocessor = {
        fragments: [],
        transpiledDocument: new SvelteDocument(document.getURL(), document.getText()),
    };

    if (preprocessors.script) {
        preprocessor.script = (async (args: any) => {
            const res = await preprocessors.script!(args);
            if (res && res.map) {
                preprocessor.fragments.push({
                    source: document.script,
                    transpiled: preprocessor.transpiledDocument.script,
                    code: res.code,
                    map: res.map as InitialMigrationAny,
                });
            }
            return res;
        }) as any;
    }

    if (preprocessors.style) {
        preprocessor.style = (async (args: any) => {
            const res = await preprocessors.style!(args);
            if (res && res.map) {
                preprocessor.fragments.push({
                    source: document.style,
                    transpiled: preprocessor.transpiledDocument.style,
                    code: res.code,
                    map: res.map as InitialMigrationAny,
                });
            }
            return res;
        }) as any;
    }

    return preprocessor;
}

async function fixDiagnostics(
    document: ReadableDocument,
    preprocessor: Preprocessor,
    diagnostics: Diagnostic[],
): Promise<void> {
    for (const fragment of preprocessor.fragments) {
        const newDiagnostics: Diagnostic[] = [];
        const fragmentDiagnostics: Diagnostic[] = [];
        for (const diag of diagnostics) {
            if (fragment.transpiled.isInGenerated(diag.range.start)) {
                fragmentDiagnostics.push(diag);
            } else {
                newDiagnostics.push(diag);
            }
        }
        diagnostics = newDiagnostics;
        if (fragmentDiagnostics.length === 0) {
            continue;
        }

        await SourceMapConsumer.with(fragment.map, null, (consumer) => {
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
    source: SvelteFragment,
    transpiled: SvelteFragment,
    consumer: SourceMapConsumer,
    pos: Position,
): Position {
    // Start with a position that exists in the transpiled fragment's parent

    // Map the position to be relative to the transpiled fragment only
    const transpiledPosition = transpiled.getGeneratedPosition(pos);

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
    return source.getOriginalPosition(sourcePosition);
}
