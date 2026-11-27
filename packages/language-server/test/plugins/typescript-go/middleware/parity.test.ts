import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
    CompletionItem,
    CompletionList,
    DocumentSymbol,
    Hover,
    SymbolKind,
    Position,
    ProtocolRequestType
} from 'vscode-languageserver';
import { TemplateASTParseLoader } from '../../../../src/plugins/svelte/TemplateASTLoader';
import { FileSystemProvider } from '../../../../src/lib/FileSystemProvider';
import { HTMLPlugin } from '../../../../src/plugins/html/HTMLPlugin';
import { PluginHost } from '../../../../src/plugins/PluginHost';
import { SveltePlugin } from '../../../../src/plugins/svelte/SveltePlugin';
import { TsgoResponseTransformer } from '../../../../src/plugins/typescript-go/middleware';
import { dedupeStartTagCompletions } from '../../../../src/plugins/typescript-go/middleware/completions';
import { TsApiService } from '../../../../src/plugins/typescript-go/TsApiService';
import { TypeScriptGoPlugin } from '../../../../src/plugins/typescript-go/TypeScriptGoPlugin';
import { TsGoFileReferencesProvider } from '../../../../src/plugins/typescript-go/features/FileReferencesProvider';
import {
    TsGoUpdateImportsProvider,
    updateSpecifier
} from '../../../../src/plugins/typescript-go/features/UpdateImportsProvider';
import { pathToUrl } from '../../../../src/utils';
import {
    createTsApiServiceForTest,
    createTsGoServiceForTest,
    isSvelte5Plus,
    TsGoServiceSetupResult
} from '../test-utils';

const testDir = path.join(__dirname, '..', 'parity');
const files = [
    'Symbols.svelte',
    'StartTag.svelte',
    'BindChild.svelte',
    'importer.ts',
    'types.d.ts',
    'lib/Nested.svelte',
    'EventChild.svelte',
    'DottedEvents.svelte'
];
const uriOf = (file: string) => pathToUrl(path.join(testDir, file));
const textOf = (file: string) => fs.readFileSync(path.join(testDir, file), 'utf-8');

function positionOf(file: string, needle: string, delta = 0): Position {
    const text = textOf(file);
    const offset = text.indexOf(needle);
    assert.ok(offset !== -1, `${needle} not found in ${file}`);
    const before = text.slice(0, offset + delta);
    const line = before.split('\n').length - 1;
    return Position.create(line, before.length - before.lastIndexOf('\n') - 1);
}

/** name -> children names, recursively, e.g. `Foo(bar)` */
function outline(symbols: DocumentSymbol[] | null | undefined): string[] {
    return (symbols ?? []).map((s) =>
        s.children?.length ? `${s.name}(${outline(s.children).join(',')})` : s.name
    );
}

describe('TS7 feature parity in content mapper mode (middleware)', function () {
    this.timeout(20_000);

    let services: TsGoServiceSetupResult;
    let api: TsApiService;
    let transformer: TsgoResponseTransformer;
    /** with the real HTML/Svelte plugins as the Svelte LS's completions */
    let pluginHost: PluginHost;

    before(async () => {
        services = await createTsGoServiceForTest(testDir, {
            textDocument: { documentSymbol: { hierarchicalDocumentSymbolSupport: true } }
        });
        // before opening the documents: the HTML plugin caches them on open
        pluginHost = new PluginHost(services.docManager);
        pluginHost.initialize({ filterIncompleteCompletions: true, definitionLinkSupport: true });
        pluginHost.register(
            new SveltePlugin(
                services.lsConfigManager,
                new TemplateASTParseLoader(services.docManager)
            )
        );
        pluginHost.register(
            new HTMLPlugin(
                services.docManager,
                services.lsConfigManager,
                new FileSystemProvider(),
                []
            )
        );
        for (const file of files) {
            services.docManager.openClientDocument({ uri: uriOf(file), text: textOf(file) });
        }
        api = await createTsApiServiceForTest(services.service, services.lsConfigManager);
        // after Svelte and HTML, as in the server
        pluginHost.register(new TypeScriptGoPlugin(api, services.lsConfigManager));
        transformer = new TsgoResponseTransformer(
            services.docManager,
            new TemplateASTParseLoader(services.docManager),
            {
                findDocumentHighlight: async () => null,
                getCompletions: (textDocument, position) =>
                    pluginHost.getCompletions(textDocument, position)
            },
            api
        );
    });

    after(async () => {
        await api?.dispose().catch(() => {});
        services?.service.dispose();
    });

    async function request<R>(method: string, params: any): Promise<{ raw: R; result: R }> {
        const raw = await services.service.sendRequest(
            new ProtocolRequestType<any, R, never, void, void>(method),
            params
        );
        const result = (await transformer.transform({
            method,
            params,
            result: structuredClone(raw)
        })) as R;
        return { raw, result };
    }

    (isSvelte5Plus ? describe : describe.skip)('document symbols', () => {
        it('TS7 alone drops the instance script (nested in the unmapped $$render)', async () => {
            const { raw } = await request<DocumentSymbol[]>('textDocument/documentSymbol', {
                textDocument: { uri: uriOf('Symbols.svelte') }
            });
            // only the module script, which svelte2tsx emits at the top level
            assert.deepStrictEqual(outline(raw), ['moduleConst']);
        });

        it('adds the instance script symbols, once, without generated or template code', async () => {
            const { result } = await request<DocumentSymbol[]>('textDocument/documentSymbol', {
                textDocument: { uri: uriOf('Symbols.svelte') }
            });
            assert.deepStrictEqual(outline(result), [
                'moduleConst',
                'Item(id,name)',
                'items',
                'count',
                'increment(step)',
                'a',
                'renamed',
                'Foo(bar)'
            ]);
        });

        it('maps the ranges to the original file', async () => {
            const { result } = await request<DocumentSymbol[]>('textDocument/documentSymbol', {
                textDocument: { uri: uriOf('Symbols.svelte') }
            });
            const increment = result.find((s) => s.name === 'increment')!;
            assert.deepStrictEqual(
                increment.selectionRange.start,
                positionOf('Symbols.svelte', 'increment()')
            );
            assert.deepStrictEqual(
                increment.range.start,
                positionOf('Symbols.svelte', 'function increment')
            );
            assert.strictEqual(increment.kind, 12 /* Function */);
        });

        it('every rebuilt symbol: the selection range is its name, inside its range and its parent', async () => {
            const { result } = await request<DocumentSymbol[]>('textDocument/documentSymbol', {
                textDocument: { uri: uriOf('Symbols.svelte') }
            });
            const text = textOf('Symbols.svelte').split('\n');
            const slice = (r: { start: Position; end: Position }) =>
                r.start.line === r.end.line
                    ? text[r.start.line].slice(r.start.character, r.end.character)
                    : undefined;
            const before = (a: Position, b: Position) =>
                a.line < b.line || (a.line === b.line && a.character <= b.character);
            const contains = (outer: DocumentSymbol['range'], inner: DocumentSymbol['range']) =>
                before(outer.start, inner.start) && before(inner.end, outer.end);
            let checked = 0;
            const visit = (symbols: DocumentSymbol[], parent?: DocumentSymbol) => {
                for (const symbol of symbols) {
                    assert.strictEqual(slice(symbol.selectionRange), symbol.name, symbol.name);
                    assert.ok(contains(symbol.range, symbol.selectionRange), symbol.name);
                    if (parent) {
                        assert.ok(contains(parent.range, symbol.range), `${symbol.name} in parent`);
                    }
                    checked++;
                    visit(symbol.children ?? [], symbol);
                }
            };
            visit(result);
            assert.ok(checked >= 11, `${checked} symbols checked`);
            assert.ok(result.every((s) => s.kind !== SymbolKind.Module));
        });
    });

    describe('file references', () => {
        it('finds the import specifiers of a Svelte file, in .svelte and .ts files', async () => {
            const references = await new TsGoFileReferencesProvider(api).fileReferences(
                uriOf('BindChild.svelte')
            );
            const at = (file: string, needle: string) => {
                const start = positionOf(file, needle, 1);
                return {
                    uri: uriOf(file),
                    range: {
                        start,
                        end: { line: start.line, character: start.character + needle.length - 2 }
                    }
                };
            };
            const sort = (locations: any[]) =>
                [...locations].sort((a, b) => a.uri.localeCompare(b.uri));
            assert.deepStrictEqual(
                sort(references ?? []),
                sort([
                    at('importer.ts', "'./BindChild.svelte'"),
                    at('lib/Nested.svelte', "'../BindChild.svelte'"),
                    at('Symbols.svelte', "'./BindChild.svelte'"),
                    // local declaration files count (only libraries are left out)
                    at('types.d.ts', "'./BindChild.svelte'")
                ])
            );
        });

        it('no references for a file nobody imports', async () => {
            assert.deepStrictEqual(
                await new TsGoFileReferencesProvider(api).fileReferences(uriOf('StartTag.svelte')),
                []
            );
        });
    });

    describe('import updates for renamed files (Svelte files only, TS7 does the rest)', () => {
        /** file -> [old specifier text, new text] */
        async function editsFor(oldFile: string, newFile: string) {
            const edit = await new TsGoUpdateImportsProvider(api).updateImports({
                oldUri: uriOf(oldFile),
                newUri: uriOf(newFile)
            });
            const result: Record<string, Array<[string, string]>> = {};
            for (const change of (edit?.documentChanges ?? []) as any[]) {
                const file = path.relative(testDir, new URL(change.textDocument.uri).pathname);
                const text = textOf(file).split('\n');
                result[file] = change.edits.map((e: any) => [
                    text[e.range.start.line].slice(e.range.start.character, e.range.end.character),
                    e.newText
                ]);
            }
            return result;
        }

        it('a renamed Svelte file: its importers in Svelte files', async () => {
            assert.deepStrictEqual(await editsFor('BindChild.svelte', 'sub/Moved.svelte'), {
                'Symbols.svelte': [['./BindChild.svelte', './sub/Moved.svelte']],
                [path.join('lib', 'Nested.svelte')]: [
                    ['../BindChild.svelte', '../sub/Moved.svelte']
                ]
            });
        });

        it("a moved Svelte file: its own relative imports, in the style they're written", async () => {
            assert.deepStrictEqual(await editsFor('lib/Nested.svelte', 'Nested.svelte'), {
                [path.join('lib', 'Nested.svelte')]: [
                    ['../BindChild.svelte', './BindChild.svelte'],
                    ['../importer', './importer'],
                    ['../importer.js', './importer.js']
                ]
            });
        });

        it('a renamed TS file: only its importers in Svelte files', async () => {
            assert.deepStrictEqual(await editsFor('importer.ts', 'lib/shared.ts'), {
                [path.join('lib', 'Nested.svelte')]: [
                    ['../importer', './shared'],
                    ['../importer.js', './shared.js']
                ]
            });
        });

        it('a renamed folder: files moving together keep their imports', async () => {
            assert.deepStrictEqual(await editsFor('lib', 'components'), {});
            assert.deepStrictEqual(await editsFor('lib', 'deep/components'), {
                [path.join('lib', 'Nested.svelte')]: [
                    ['../BindChild.svelte', '../../BindChild.svelte'],
                    ['../importer', '../../importer'],
                    ['../importer.js', '../../importer.js']
                ]
            });
        });
    });

    (isSvelte5Plus ? describe : describe.skip)('start tag completions', () => {
        async function completionsAt(needle: string, delta: number) {
            const position = positionOf('StartTag.svelte', needle, delta);
            const { raw, result } = await request<CompletionList>('textDocument/completion', {
                textDocument: { uri: uriOf('StartTag.svelte') },
                position
            });
            const svelte = await pluginHost.getCompletions(
                { uri: uriOf('StartTag.svelte') },
                position
            );
            return {
                rawLabels: raw.items.map((i) => i.label),
                labels: result.items.map((i) => i.label),
                svelteLabels: new Set(svelte.items.map((i) => i.label)),
                result
            };
        }

        it('drops TS7 attributes the Svelte LS offers with the same label (real HTML/Svelte plugins)', async () => {
            const { rawLabels, labels, svelteLabels } = await completionsAt('<input on', 9);
            const shared = rawLabels.filter((label) => svelteLabels.has(label));
            // non-vacuous: TS7 and the Svelte LS really overlap here
            assert.ok(shared.length > 50, `${shared.length} shared labels`);
            assert.deepStrictEqual(
                labels.filter((label) => svelteLabels.has(label)),
                [],
                'no label offered by both'
            );
            // exactly what only TS7 offers stays (unquoted), e.g. the modern event attributes
            const unquote = (label: string) => label.replace(/^"(.+)"$/, '$1');
            assert.deepStrictEqual(
                labels,
                rawLabels.map(unquote).filter((label) => !svelteLabels.has(label))
            );
            for (const label of ['oncopy', 'onintrostart']) {
                assert.ok(labels.includes(label), `${label} kept`);
            }
        });

        it('keeps modern event attributes next to the legacy directive (Svelte 5)', async () => {
            // the Svelte LS only offers on:introstart; choosing it next to onclick={...} would be
            // mixed_event_handler_syntaxes
            const { labels, svelteLabels } = await completionsAt('<div onclick={handler} on', 25);
            assert.ok(svelteLabels.has('on:introstart'));
            assert.ok(!svelteLabels.has('onintrostart'));
            assert.ok(labels.includes('onintrostart'));
        });

        it('leaves completions outside of start tags alone', async () => {
            const { raw, result } = await request<CompletionList>('textDocument/completion', {
                textDocument: { uri: uriOf('StartTag.svelte') },
                position: positionOf('StartTag.svelte', '{x}', 2)
            });
            assert.deepStrictEqual(result, raw);
        });
    });

    describe('component event hover', () => {
        /** TS7's own hover and the Svelte language server's (the first plugin answer) */
        async function hoverAt(needle: string, delta: number) {
            const textDocument = { uri: uriOf('DottedEvents.svelte') };
            const position = positionOf('DottedEvents.svelte', needle, delta);
            const { raw } = await request<Hover | null>('textDocument/hover', {
                textDocument,
                position
            });
            const result = await pluginHost.doHover(textDocument, position);
            return { raw, value: (result?.contents as any)?.value as string | undefined };
        }

        it('resolves the event of a component', async () => {
            const { raw, value } = await hoverAt('<EventChild on:abc', 16);
            assert.strictEqual(raw, null, 'TS7 alone has none');
            assert.ok(value?.includes('abc: CustomEvent<MouseEvent>'), value);
        });

        it('resolves the event of a dotted component (the last part is the component)', async () => {
            const { raw, value } = await hoverAt('<UI.EventChild on:abc', 19);
            assert.strictEqual(raw, null, 'TS7 alone has none');
            assert.ok(value?.includes('abc: CustomEvent<MouseEvent>'), value);
        });
    });
});

describe('updateSpecifier', () => {
    const from = (specifier: string, target: string, importerDir: string, targetTo: string) =>
        updateSpecifier(specifier, target, importerDir, targetTo);
    it('keeps the written style', () => {
        assert.strictEqual(
            from('./A.svelte', '/p/A.svelte', '/p', '/p/x/B.svelte'),
            './x/B.svelte'
        );
        assert.strictEqual(from('./util', '/p/util.ts', '/p/x', '/p/util.ts'), '../util');
        assert.strictEqual(
            from('./util.js', '/p/util.ts', '/p', '/p/lib/util.ts'),
            './lib/util.js'
        );
        assert.strictEqual(from('./types', '/p/types.d.ts', '/p', '/p/t/types.d.ts'), './t/types');
        assert.strictEqual(
            from('./lib', '/p/lib/index.ts', '/p', '/p/src/lib/index.ts'),
            './src/lib'
        );
        // an index that is no longer one: the file, extensionless
        assert.strictEqual(
            from('./lib', '/p/lib/index.ts', '/p', '/p/other/entry.ts'),
            './other/entry'
        );
        assert.strictEqual(from('.', '/p/lib/index.ts', '/p/lib', '/p/lib/entry.ts'), './entry');
        assert.strictEqual(from('../A.svelte', '/p/A.svelte', '/p', '/p/A.svelte'), './A.svelte');
    });
    it('gives up on styles it does not know', () => {
        assert.strictEqual(from('./weird', '/p/other.ts', '/p', '/p/x/other.ts'), undefined);
    });
});

describe('dedupeStartTagCompletions', () => {
    it('drops same labels (also quoted ones), not onX for on:X', () => {
        const result = dedupeStartTagCompletions(
            [
                CompletionItem.create('"aria-label"'),
                CompletionItem.create('"data-x"'),
                CompletionItem.create('onclick'),
                CompletionItem.create('onintrostart'),
                CompletionItem.create('value'),
                CompletionItem.create('accept')
            ],
            new Set(['aria-label', 'on:click', 'on:introstart', 'accept'])
        );
        assert.deepStrictEqual(
            result.map((i) => [i.label, i.sortText]),
            [
                ['data-x', 'Z'],
                ['onclick', 'Z'],
                ['onintrostart', 'Z'],
                ['value', 'Z']
            ]
        );
    });

    it('keeps everything without Svelte LS labels', () => {
        const items = [CompletionItem.create('a')];
        assert.strictEqual(dedupeStartTagCompletions(items, new Set()), items);
    });
});
