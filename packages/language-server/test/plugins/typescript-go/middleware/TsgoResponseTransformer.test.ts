import assert from 'assert';
import {
    Diagnostic,
    DiagnosticSeverity,
    DocumentDiagnosticReport,
    DocumentHighlight,
    DocumentHighlightKind,
    Range
} from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager } from '../../../../src/ls-config';
import { FileSystemProvider } from '../../../../src/lib/FileSystemProvider';
import { HTMLPlugin } from '../../../../src/plugins/html/HTMLPlugin';
import { PluginHost } from '../../../../src/plugins/PluginHost';
import { SveltePlugin } from '../../../../src/plugins/svelte/SveltePlugin';
import { TemplateASTParseLoader } from '../../../../src/plugins/svelte/TemplateASTLoader';
import {
    TransformTsgoResponseParams,
    TsgoResponseTransformer
} from '../../../../src/plugins/typescript-go/middleware';

/**
 * The TS7 responses used here are trimmed copies of what `tsc --lsp` (7.1.0-dev.20261103.1) returned
 * for the same Svelte files with `@sveltejs/ts-content-mapper`.
 */
describe('TsgoResponseTransformer', () => {
    function setup(content: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const configManager = new LSConfigManager();
        const astLoader = new TemplateASTParseLoader(docManager);
        const pluginHost = new PluginHost(docManager);
        pluginHost.initialize({ filterIncompleteCompletions: true, definitionLinkSupport: true });
        pluginHost.register(new SveltePlugin(configManager, astLoader));
        pluginHost.register(
            new HTMLPlugin(docManager, configManager, new FileSystemProvider(), [])
        );
        const uri = 'file:///test/Test.svelte';
        docManager.openClientDocument({ uri, text: content });
        const transformer = new TsgoResponseTransformer(docManager, astLoader, pluginHost);
        return {
            uri,
            transform: <R>(
                params: Omit<TransformTsgoResponseParams<any, R>, 'params'> & { params?: any }
            ) =>
                transformer.transform({
                    params: { textDocument: { uri } },
                    ...params
                }) as Promise<R>
        };
    }

    function diag(
        range: [number, number, number, number],
        code: number,
        message: string,
        extra: Partial<Diagnostic> = {}
    ): Diagnostic {
        return {
            range: Range.create(...range),
            code,
            message,
            source: 'ts',
            severity: DiagnosticSeverity.Error,
            ...extra
        };
    }

    async function transformDiagnostics(content: string, items: Diagnostic[]) {
        const { transform } = setup(content);
        const report = await transform<DocumentDiagnosticReport>({
            method: 'textDocument/diagnostic',
            result: { kind: 'full', resultId: '1', items }
        });
        assert.strictEqual(report.kind, 'full');
        return report.kind === 'full' ? report.items : [];
    }

    describe('diagnostics', () => {
        const legacy = `<script lang="ts">
	export let x: string;
	export let y: number = 1;
	let z = 0;
	$: x, y, z;
	$: doubled = y * 2;
</script>

{x}{doubled}`;

        it('drops unused `$` labels and comma noops of reactive statements', async () => {
            const items = await transformDiagnostics(legacy, [
                diag(
                    [4, 4, 4, 5],
                    2695,
                    'Left side of comma operator is unused and has no side effects.'
                ),
                diag(
                    [4, 4, 4, 8],
                    2695,
                    'Left side of comma operator is unused and has no side effects.'
                ),
                diag([4, 1, 4, 2], 7028, 'Unused label.', { severity: DiagnosticSeverity.Hint }),
                diag([5, 1, 5, 2], 7028, 'Unused label.', { severity: DiagnosticSeverity.Hint })
            ]);
            assert.deepStrictEqual(items, []);
        });

        it('keeps comma noops outside of reactive statements', async () => {
            const content = `<script lang="ts">\n\tlet a = 1;\n\ta, a;\n</script>`;
            const noop = diag(
                [2, 1, 2, 2],
                2695,
                'Left side of comma operator is unused and has no side effects.'
            );
            assert.deepStrictEqual(await transformDiagnostics(content, [noop]), [noop]);
        });

        it('drops the mapper parse error and unused hints when svelte2tsx failed', async () => {
            const content = `<script lang="ts">\n\tlet n = 1;\n\tlet broken: string = 1;\n</script>\n\n<div class="x" class="y">{n}</div>`;
            const typeError = diag(
                [2, 5, 2, 11],
                2322,
                "Type 'number' is not assignable to type 'string'."
            );
            const items = await transformDiagnostics(content, [
                diag(
                    [5, 15, 5, 24],
                    -1,
                    'Attributes need to be unique\nhttps://svelte.dev/e/attribute_duplicate',
                    { source: 'svelte' }
                ),
                diag([1, 5, 1, 6], 6133, "'n' is declared but its value is never read.", {
                    severity: DiagnosticSeverity.Hint,
                    tags: [1]
                }),
                typeError
            ]);
            assert.deepStrictEqual(items, [typeError]);
        });

        it('relocates a non-bindable error out of the virtual code diagnostic', async () => {
            const content = `<script lang="ts">\n\timport Child from './Child.svelte';\n\tlet count = 0;\n</script>\n\n<Child bind:value={count} req="r" />`;
            const items = await transformDiagnostics(content, [
                diag(
                    [0, 0, 0, 0],
                    18080,
                    "Virtual code produced by the content mapper '@sveltejs/ts-content-mapper@0.1.0' has problems with no corresponding location in this file.",
                    {
                        relatedInformation: [
                            {
                                location: {
                                    uri: 'file:///test/Test.svelte',
                                    range: Range.create(0, 0, 0, 0)
                                },
                                message: `Type '"value"' is not assignable to type '""'.`
                            }
                        ]
                    }
                )
            ]);
            assert.deepStrictEqual(items, [
                {
                    range: Range.create(5, 7, 5, 25),
                    code: 18080,
                    source: 'ts',
                    severity: DiagnosticSeverity.Error,
                    relatedInformation: undefined,
                    message:
                        "Cannot use 'bind:' with this property. It is declared as non-bindable inside the component.\n" +
                        "To mark a property as bindable: 'let { value = $bindable() } = $props()'"
                }
            ]);
        });

        it('keeps virtual code diagnostics it cannot place', async () => {
            const related = {
                location: { uri: 'file:///test/Test.svelte', range: Range.create(0, 0, 0, 0) },
                message: 'No overload matches this call.'
            };
            const virtual = diag([0, 0, 0, 0], 18080, 'Virtual code ...', {
                relatedInformation: [related]
            });
            const items = await transformDiagnostics(legacy, [virtual]);
            assert.deepStrictEqual(items, [virtual]);
        });

        it('dedupes identical diagnostics', async () => {
            const d = diag([1, 1, 1, 2], 2304, "Cannot find name 'a'.");
            assert.deepStrictEqual(await transformDiagnostics(legacy, [d, { ...d }]), [d]);
        });

        it('passes unchanged reports through', async () => {
            const { transform } = setup(legacy);
            const report = { kind: 'unchanged', resultId: '1' };
            assert.deepStrictEqual(
                await transform({ method: 'textDocument/diagnostic', result: report }),
                report
            );
        });
    });

    describe('document highlight', () => {
        const content = `<script lang="ts">\n\tlet show = true;\n</script>\n\n{#if show}\n\t<p>a</p>\n{:else}\n\t<p>b</p>\n{/if}`;
        const tsHighlights: DocumentHighlight[] = [
            { range: Range.create(1, 5, 1, 9), kind: DocumentHighlightKind.Write },
            { range: Range.create(4, 5, 4, 9), kind: DocumentHighlightKind.Read }
        ];

        it('prefers Svelte block highlights', async () => {
            const { transform } = setup(content);
            const result = await transform<DocumentHighlight[]>({
                method: 'textDocument/documentHighlight',
                params: {
                    textDocument: { uri: 'file:///test/Test.svelte' },
                    position: { line: 6, character: 3 }
                },
                // TS7 highlights the `else` of the generated if statement
                result: [{ range: Range.create(6, 2, 6, 6), kind: DocumentHighlightKind.Text }]
            });
            assert.deepStrictEqual(
                result.map((h) => h.range),
                [Range.create(4, 1, 4, 4), Range.create(8, 1, 8, 4), Range.create(6, 1, 6, 6)]
            );
        });

        it('prefers HTML tag highlights', async () => {
            const { transform } = setup(content);
            const result = await transform<DocumentHighlight[]>({
                method: 'textDocument/documentHighlight',
                params: {
                    textDocument: { uri: 'file:///test/Test.svelte' },
                    position: { line: 5, character: 2 }
                },
                // TS7 only highlights the start tag (`svelteHTML.createElement("p")`)
                result: [{ range: Range.create(5, 2, 5, 3), kind: DocumentHighlightKind.Text }]
            });
            assert.deepStrictEqual(
                result.map((h) => h.range),
                [Range.create(5, 2, 5, 3), Range.create(5, 7, 5, 8)]
            );
        });

        it('falls back to TS7 highlights', async () => {
            const { transform } = setup(content);
            const result = await transform<DocumentHighlight[]>({
                method: 'textDocument/documentHighlight',
                params: {
                    textDocument: { uri: 'file:///test/Test.svelte' },
                    position: { line: 4, character: 6 }
                },
                result: tsHighlights
            });
            assert.deepStrictEqual(result, tsHighlights);
        });
    });
});
