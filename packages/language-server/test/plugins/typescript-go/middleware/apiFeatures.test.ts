import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
    Diagnostic,
    DocumentDiagnosticReport,
    Location,
    LocationLink,
    Position,
    ProtocolRequestType,
    Range,
    TextEdit,
    WorkspaceEdit
} from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { TemplateASTParseLoader } from '../../../../src/plugins/svelte/TemplateASTLoader';
import { TsgoResponseTransformer } from '../../../../src/plugins/typescript-go/middleware';
import { TsApiService } from '../../../../src/plugins/typescript-go/TsApiService';
import { TypeScriptGoPlugin } from '../../../../src/plugins/typescript-go/TypeScriptGoPlugin';
import { pathToUrl } from '../../../../src/utils';
import {
    createTsApiServiceForTest,
    createTsGoServiceForTest,
    isSvelte5Plus,
    TsGoServiceSetupResult
} from '../test-utils';

const testDir = path.join(__dirname, '..', 'testfiles');
const files = [
    'stores.ts',
    'StoreUser.svelte',
    'StoreAlias.svelte',
    'LocalStores.svelte',
    'NotAStore.svelte',
    'BindChild.svelte',
    'BindableChild.svelte',
    'BindParent.svelte',
    'ClassComponentUser.svelte'
];

const uriOf = (file: string) => pathToUrl(path.join(testDir, file));
const textOf = (file: string) => fs.readFileSync(path.join(testDir, file), 'utf-8');

/** Position of the `occurrence`th `needle` in `file`, plus `delta` characters */
function positionOf(file: string, needle: string, delta = 0, occurrence = 0): Position {
    const text = textOf(file);
    let offset = -1;
    for (let i = 0; i <= occurrence; i++) {
        offset = text.indexOf(needle, offset + 1);
    }
    assert.ok(offset !== -1, `${needle} not found in ${file}`);
    const before = text.slice(0, offset + delta);
    const line = before.split('\n').length - 1;
    return Position.create(line, before.length - before.lastIndexOf('\n') - 1);
}

/** Range of the `occurrence`th `needle` in `file`, or of `length` characters at `delta` inside it */
function rangeOf(
    file: string,
    needle: string,
    occurrence = 0,
    delta = 0,
    length = needle.length - delta
): Range {
    const start = positionOf(file, needle, delta, occurrence);
    return Range.create(start, Position.create(start.line, start.character + length));
}

const loc = (file: string, needle: string, occurrence = 0, delta = 0, length?: number) => ({
    uri: uriOf(file),
    range: rangeOf(file, needle, occurrence, delta, length)
});

function sortLocations(locations: Location[] | null | undefined) {
    return [...(locations ?? [])].sort(
        (a, b) =>
            a.uri.localeCompare(b.uri) ||
            a.range.start.line - b.range.start.line ||
            a.range.start.character - b.range.start.character
    );
}

describe('TS7 features through the API connection', function () {
    this.timeout(20_000);

    let services: TsGoServiceSetupResult;
    let api: TsApiService;
    let transformer: TsgoResponseTransformer;

    before(async () => {
        services = await createTsGoServiceForTest(testDir);
        for (const file of files) {
            services.docManager.openClientDocument({ uri: uriOf(file), text: textOf(file) });
        }
        api = await createTsApiServiceForTest(services.service, services.lsConfigManager);
        transformer = new TsgoResponseTransformer(
            services.docManager,
            new TemplateASTParseLoader(services.docManager),
            { findDocumentHighlight: async () => null },
            api
        );
    });

    after(async () => {
        await api?.dispose().catch(() => {});
        services?.service.dispose();
    });

    /** Sends the request to TS7, then runs its response through the middleware transformation */
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

    describe('$store', () => {
        it('finds the store and the $store usages of all subscriptions from $store', async () => {
            const { result } = await request<Location[]>('textDocument/references', {
                textDocument: { uri: uriOf('StoreUser.svelte') },
                position: positionOf('StoreUser.svelte', '$count', 2),
                context: { includeDeclaration: true }
            });

            assert.deepStrictEqual(
                sortLocations(result),
                sortLocations([
                    loc('stores.ts', 'count'),
                    loc('StoreUser.svelte', 'count'),
                    loc('StoreUser.svelte', '$count'),
                    loc('StoreUser.svelte', '$count', 1),
                    loc('StoreAlias.svelte', 'count'),
                    loc('StoreAlias.svelte', 'as c', 0, 3),
                    loc('StoreAlias.svelte', '$c')
                ])
            );
        });

        it('adds the $store usages to the references of a store in a .ts file', async () => {
            const { raw, result } = await request<Location[]>('textDocument/references', {
                textDocument: { uri: uriOf('stores.ts') },
                position: positionOf('stores.ts', 'count', 1),
                context: { includeDeclaration: true }
            });

            const added = sortLocations(result).filter(
                (l) => !raw.some((r) => JSON.stringify(r) === JSON.stringify(l))
            );
            assert.deepStrictEqual(added, [
                loc('StoreAlias.svelte', '$c'),
                loc('StoreUser.svelte', '$count'),
                loc('StoreUser.svelte', '$count', 1)
            ]);
        });

        it('respects includeDeclaration', async () => {
            const { result } = await request<Location[]>('textDocument/references', {
                textDocument: { uri: uriOf('LocalStores.svelte') },
                position: positionOf('LocalStores.svelte', '$local', 2),
                context: { includeDeclaration: false }
            });

            assert.deepStrictEqual(sortLocations(result), [loc('LocalStores.svelte', '$local')]);
        });

        it('leaves references of other identifiers alone', async () => {
            const { raw, result } = await request<Location[]>('textDocument/references', {
                textDocument: { uri: uriOf('StoreUser.svelte') },
                position: positionOf('StoreUser.svelte', 'increment', 2),
                context: { includeDeclaration: true }
            });

            assert.deepStrictEqual(result, raw);
            assert.strictEqual(result.length, 2);
        });

        it('only resolves the references in Svelte files to find the subscriptions of a store', async () => {
            // Resolving a reference fetches the AST of its file, and this runs for every identifier
            const NodeHandle = api.apiModule.NodeHandle as any;
            const resolve = NodeHandle.prototype.resolve;
            const resolved: string[] = [];
            NodeHandle.prototype.resolve = function (...args: unknown[]) {
                resolved.push(this.path);
                return resolve.apply(this, args);
            };
            try {
                await request<Location[]>('textDocument/references', {
                    textDocument: { uri: uriOf('stores.ts') },
                    position: positionOf('stores.ts', 'count', 1),
                    context: { includeDeclaration: true }
                });
            } finally {
                NodeHandle.prototype.resolve = resolve;
            }

            assert.ok(resolved.length > 0, 'expected the subscriptions to be resolved');
            assert.deepStrictEqual(
                resolved.filter((path) => !path.endsWith('.svelte')),
                []
            );
        });

        it('goes to the definition of the store from $store', async () => {
            const imported = await request<LocationLink[]>('textDocument/definition', {
                textDocument: { uri: uriOf('StoreUser.svelte') },
                position: positionOf('StoreUser.svelte', '$count', 2)
            });
            assert.deepStrictEqual(imported.raw, []);
            assert.deepStrictEqual(imported.result, [
                {
                    originSelectionRange: rangeOf('StoreUser.svelte', '$count'),
                    targetUri: uriOf('stores.ts'),
                    targetRange: rangeOf('stores.ts', 'count = writable(0)'),
                    targetSelectionRange: rangeOf('stores.ts', 'count')
                }
            ]);

            // a destructured store, with a shadowing declaration of `local` in a function
            const destructured = await request<LocationLink[]>('textDocument/definition', {
                textDocument: { uri: uriOf('LocalStores.svelte') },
                position: positionOf('LocalStores.svelte', '$destructured', 2)
            });
            assert.deepStrictEqual(
                destructured.result.map((l) => l.targetSelectionRange),
                [rangeOf('LocalStores.svelte', 'destructured')]
            );

            const local = await request<LocationLink[]>('textDocument/definition', {
                textDocument: { uri: uriOf('LocalStores.svelte') },
                position: positionOf('LocalStores.svelte', '$local', 2)
            });
            assert.deepStrictEqual(
                local.result.map((l) => l.targetSelectionRange),
                [rangeOf('LocalStores.svelte', 'local')]
            );
        });

        it('only renames the store part of $store', async () => {
            const { result } = await request('textDocument/prepareRename', {
                textDocument: { uri: uriOf('StoreUser.svelte') },
                position: positionOf('StoreUser.svelte', '$count', 2)
            });
            assert.deepStrictEqual(result, {
                range: rangeOf('StoreUser.svelte', '$count', 0, 1),
                placeholder: 'count'
            });
        });

        it('tells where the store of $store is bound', async () => {
            const alias = await transformer.getStoreBinding({
                textDocument: { uri: uriOf('StoreAlias.svelte') },
                position: positionOf('StoreAlias.svelte', '$c', 1)
            });
            assert.deepStrictEqual(alias, {
                uri: uriOf('StoreAlias.svelte'),
                position: positionOf('StoreAlias.svelte', 'c }')
            });

            const notAStoreUsage = await transformer.getStoreBinding({
                textDocument: { uri: uriOf('StoreUser.svelte') },
                position: positionOf('StoreUser.svelte', 'increment', 2)
            });
            assert.strictEqual(notAStoreUsage, null);
        });

        it('fails to tell the store of $store when the snapshot does not match the document', async () => {
            // null would make the extension use TS7's rename, which breaks the code for a `$store`
            const docManager = new DocumentManager((textDocument) =>
                Document.createForTest(textDocument.uri, textDocument.text)
            );
            docManager.openClientDocument({
                uri: uriOf('StoreAlias.svelte'),
                text: textOf('StoreAlias.svelte') + '\n<p>edited</p>'
            });
            const ahead = new TsgoResponseTransformer(
                docManager,
                new TemplateASTParseLoader(docManager),
                { findDocumentHighlight: async () => null },
                api
            );
            await assert.rejects(
                ahead.getStoreBinding({
                    textDocument: { uri: uriOf('StoreAlias.svelte') },
                    position: positionOf('StoreAlias.svelte', '$c', 1)
                }),
                /snapshot/
            );
        });

        it('renames the $store usages together with the store', async () => {
            const { raw, result } = await request<WorkspaceEdit>('textDocument/rename', {
                textDocument: { uri: uriOf('stores.ts') },
                position: positionOf('stores.ts', 'count', 1),
                newName: 'total'
            });

            const editsOf = (edit: WorkspaceEdit, file: string): TextEdit[] =>
                [...(edit.changes?.[uriOf(file)] ?? [])].sort(
                    (a, b) =>
                        a.range.start.line - b.range.start.line ||
                        a.range.start.character - b.range.start.character
                );
            // StoreUser's binding is renamed, so are its `$count` usages
            assert.deepStrictEqual(editsOf(result, 'StoreUser.svelte'), [
                ...editsOf(raw, 'StoreUser.svelte'),
                { range: rangeOf('StoreUser.svelte', '$count'), newText: '$total' },
                { range: rangeOf('StoreUser.svelte', '$count', 1), newText: '$total' }
            ]);
            // StoreAlias keeps its local name `c`
            assert.deepStrictEqual(
                editsOf(result, 'StoreAlias.svelte'),
                editsOf(raw, 'StoreAlias.svelte')
            );
        });

        it('leaves renames starting at $store to the extension', async () => {
            const { raw, result } = await request<WorkspaceEdit>('textDocument/rename', {
                textDocument: { uri: uriOf('StoreUser.svelte') },
                position: positionOf('StoreUser.svelte', '$count', 2),
                newName: 'total'
            });
            assert.deepStrictEqual(result, raw);
        });
    });

    describe('virtual code diagnostics', () => {
        async function diagnostics(file: string) {
            const { result } = await request<DocumentDiagnosticReport>('textDocument/diagnostic', {
                textDocument: { uri: uriOf(file) }
            });
            assert.strictEqual(result.kind, 'full');
            return (result as { items: Diagnostic[] }).items;
        }

        it('places store misuse at the $store usages', async () => {
            const items = await diagnostics('NotAStore.svelte');

            assert.deepStrictEqual(
                items.map((d) => [d.code, d.range]),
                [[2769, rangeOf('NotAStore.svelte', '$notAStore')]]
            );
            assert.ok(
                items[0].message.startsWith(
                    "Cannot use 'notAStore' as a store. 'notAStore' needs to be an object with a subscribe method on it.\n\nNo overload matches this call."
                ),
                items[0].message
            );
            assert.ok(!items[0].message.includes('virtual code'), items[0].message);
        });

        (isSvelte5Plus ? it : it.skip)(
            'places a non-bindable error at the bind: directive of the right component',
            async () => {
                const items = await diagnostics('BindParent.svelte');

                assert.deepStrictEqual(items, [
                    {
                        range: rangeOf('BindParent.svelte', 'bind:value={count}', 1),
                        severity: 1,
                        source: 'ts',
                        code: 2322,
                        message:
                            "Cannot use 'bind:' with this property. It is declared as non-bindable inside the component.\n" +
                            "To mark a property as bindable: 'let { value = $bindable() } = $props()'"
                    }
                ]);
            }
        );

        // Svelte 4 doesn't deprecate the class component constructor or `$on`
        (isSvelte5Plus ? it : it.skip)(
            'drops deprecations of the generated code for class components',
            async () => {
                const { raw, result } = await request<DocumentDiagnosticReport>(
                    'textDocument/diagnostic',
                    { textDocument: { uri: uriOf('ClassComponentUser.svelte') } }
                );

                // the generated `new $$_…C(...)` and `$$_….$on(...)`, both in unmapped code
                assert.strictEqual(raw.kind, 'full');
                assert.deepStrictEqual(
                    (raw as { items: Diagnostic[] }).items.map((d) => d.code),
                    [18080]
                );
                assert.deepStrictEqual(result, { ...raw, items: [] });
            }
        );
    });

    describe('component references', () => {
        it('finds the start tags of a component, from its script tag', async () => {
            const plugin = new TypeScriptGoPlugin(api, services.lsConfigManager);
            const document = services.docManager.get(uriOf('BindChild.svelte'))!;

            const references = await plugin.findReferences(document, Position.create(0, 2));

            assert.deepStrictEqual(sortLocations(references), [
                loc('BindParent.svelte', 'BindChild'),
                loc('BindParent.svelte', 'BindChild', 2)
            ]);
        });
    });
});
