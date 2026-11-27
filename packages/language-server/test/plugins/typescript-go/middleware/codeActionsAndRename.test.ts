import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
    CodeActionKind,
    Diagnostic,
    DocumentDiagnosticReport,
    ProtocolRequestType,
    TextDocumentEdit
} from 'vscode-languageserver';
import { TypeScriptGoPlugin } from '../../../../src/plugins/typescript-go/TypeScriptGoPlugin';
import { TsApiService } from '../../../../src/plugins/typescript-go/TsApiService';
import { TsGoUpdateImportsProvider } from '../../../../src/plugins/typescript-go/features/UpdateImportsProvider';
import { pathToUrl } from '../../../../src/utils';
import {
    createTsApiServiceForTest,
    createTsGoServiceForTest,
    isSvelte5Plus,
    TsGoServiceSetupResult
} from '../test-utils';

(isSvelte5Plus ? describe : describe.skip)(
    'Add lang="ts" code action (content mapper mode, TS7 diagnostics)',
    function () {
        this.timeout(20_000);
        const testDir = path.join(__dirname, '..', 'parity');
        const uriOf = (file: string) => pathToUrl(path.join(testDir, file));
        const files = ['AddLang.svelte', 'AddLangTemplate.svelte', 'AddLangNoScript.svelte'];

        let services: TsGoServiceSetupResult;
        let api: TsApiService;
        let plugin: TypeScriptGoPlugin;
        before(async () => {
            services = await createTsGoServiceForTest(testDir);
            for (const file of files) {
                services.docManager.openClientDocument({
                    uri: uriOf(file),
                    text: fs.readFileSync(path.join(testDir, file), 'utf-8')
                });
            }
            api = await createTsApiServiceForTest(services.service, services.lsConfigManager);
            plugin = new TypeScriptGoPlugin(api, services.lsConfigManager);
        });
        after(async () => {
            await api?.dispose().catch(() => {});
            services?.service.dispose();
        });

        async function tsDiagnostics(file: string): Promise<Diagnostic[]> {
            const report = await services.service.sendRequest(
                new ProtocolRequestType<any, DocumentDiagnosticReport, never, void, void>(
                    'textDocument/diagnostic'
                ),
                { textDocument: { uri: uriOf(file) } }
            );
            return report.kind === 'full' ? report.items : [];
        }

        async function actionsFor(file: string, only?: string[]) {
            const diagnostics = await tsDiagnostics(file);
            const document = services.docManager.get(uriOf(file))!;
            return {
                diagnostics,
                actions: plugin.getCodeActions(document, diagnostics[0]?.range ?? ({} as any), {
                    diagnostics,
                    only
                })
            };
        }

        const edits = (action: any) =>
            (action.edit.documentChanges[0] as TextDocumentEdit).edits.map((e) => [
                e.range.start.line,
                e.range.start.character,
                e.newText
            ]);

        it('adds lang="ts" to both script tags for a type annotation (TS8010)', async () => {
            const { diagnostics, actions } = await actionsFor('AddLang.svelte', [
                CodeActionKind.QuickFix
            ]);
            assert.ok(
                diagnostics.some((d) => d.code === 8010),
                JSON.stringify(diagnostics.map((d) => d.code))
            );
            assert.deepStrictEqual(
                actions.map((a) => [a.title, a.kind]),
                [['Add lang="ts" to <script> tag', CodeActionKind.QuickFix]]
            );
            assert.deepStrictEqual(edits(actions[0]), [
                [0, 7, ' lang="ts"'],
                [4, 7, ' lang="ts"']
            ]);
        });

        it('for a TS-only expression in the template (TS8016)', async () => {
            const { diagnostics, actions } = await actionsFor('AddLangTemplate.svelte');
            assert.ok(
                diagnostics.some((d) => Number(d.code) >= 8004 && Number(d.code) <= 8017),
                JSON.stringify(diagnostics.map((d) => d.code))
            );
            assert.deepStrictEqual(edits(actions[0]), [[0, 7, ' lang="ts"']]);
        });

        it('adds a <script lang="ts"> tag to a document without script', async () => {
            const { diagnostics, actions } = await actionsFor('AddLangNoScript.svelte');
            assert.ok(
                diagnostics.some((d) => Number(d.code) >= 8004 && Number(d.code) <= 8017),
                JSON.stringify(diagnostics.map((d) => d.code))
            );
            assert.strictEqual(actions[0]?.title, 'Add <script lang="ts"> tag');
            assert.deepStrictEqual(edits(actions[0]), [[0, 0, '<script lang="ts"></script>\n']]);
        });

        it('nothing without such a diagnostic, for other kinds, or for lang="ts" scripts', async () => {
            const document = services.docManager.get(uriOf('AddLang.svelte'))!;
            const { diagnostics } = await actionsFor('AddLang.svelte');
            const range = diagnostics[0].range;
            assert.deepStrictEqual(plugin.getCodeActions(document, range, { diagnostics: [] }), []);
            assert.deepStrictEqual(
                plugin.getCodeActions(document, range, {
                    diagnostics,
                    only: [CodeActionKind.SourceOrganizeImports]
                }),
                []
            );
            const ts = services.docManager.openClientDocument({
                uri: uriOf('AddLangTs.svelte'),
                text: '<script lang="ts">\n\tlet n: number = 1;\n</script>\n'
            });
            assert.deepStrictEqual(plugin.getCodeActions(ts, range, { diagnostics }), []);
        });
    }
);

describe('import updates across projects (content mapper mode)', function () {
    this.timeout(20_000);
    const testDir = path.join(__dirname, '..', 'rename-projects');
    const uriOf = (file: string) => pathToUrl(path.join(testDir, file));
    const textOf = (file: string) => fs.readFileSync(path.join(testDir, file), 'utf-8');

    let services: TsGoServiceSetupResult;
    let api: TsApiService;
    before(async () => {
        services = await createTsGoServiceForTest(testDir);
        // opening a file of each project loads both projects in TS7
        for (const file of ['p1/App.svelte', 'p2/App.svelte']) {
            services.docManager.openClientDocument({ uri: uriOf(file), text: textOf(file) });
            await services.service.sendRequest(
                new ProtocolRequestType<any, any, never, void, void>('textDocument/documentSymbol'),
                { textDocument: { uri: uriOf(file) } }
            );
        }
        api = await createTsApiServiceForTest(services.service, services.lsConfigManager);
    });
    after(async () => {
        await api?.dispose().catch(() => {});
        services?.service.dispose();
    });

    /** file -> [old specifier text, new text] */
    async function editsFor(...renames: Array<[string, string]>) {
        const edit = await new TsGoUpdateImportsProvider(api).updateImports(
            renames.map(([from, to]) => ({ oldUri: uriOf(from), newUri: uriOf(to) }))
        );
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

    it('a shared component: importers in every loaded project', async () => {
        assert.deepStrictEqual(await editsFor(['p1/Child.svelte', 'p1/Moved.svelte']), {
            [path.join('p1', 'App.svelte')]: [['./Child.svelte', './Moved.svelte']],
            [path.join('p2', 'App.svelte')]: [['../p1/Child.svelte', '../p1/Moved.svelte']]
        });
    });

    it('a batch spanning two projects', async () => {
        assert.deepStrictEqual(
            await editsFor(
                ['p1/Child.svelte', 'p1/Moved.svelte'],
                ['p2/Child.svelte', 'p2/Moved.svelte']
            ),
            {
                [path.join('p1', 'App.svelte')]: [['./Child.svelte', './Moved.svelte']],
                [path.join('p2', 'App.svelte')]: [
                    ['./Child.svelte', './Moved.svelte'],
                    ['../p1/Child.svelte', '../p1/Moved.svelte']
                ]
            }
        );
    });

    it('an index.ts renamed to another name: directory specifiers become file specifiers', async () => {
        assert.deepStrictEqual(await editsFor(['p1/lib/index.ts', 'p1/lib/entry.ts']), {
            [path.join('p1', 'UsesLib.svelte')]: [['./lib', './lib/entry']],
            [path.join('p1', 'lib', 'Uses.svelte')]: [['.', './entry']]
        });
    });

    it('a folder with its index moved: directory specifiers stay directories', async () => {
        assert.deepStrictEqual(await editsFor(['p1/lib', 'p1/other']), {
            [path.join('p1', 'UsesLib.svelte')]: [['./lib', './other']]
        });
    });
});
