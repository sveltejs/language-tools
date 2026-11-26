import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
    Diagnostic,
    DocumentDiagnosticParams,
    DocumentDiagnosticReport,
    DocumentDiagnosticRequest
} from 'vscode-languageserver';
import { TsgoResponseTransformer } from '../../../../../src/plugins/typescript-go/middleware';
import { findUnresolvedSvelteImports } from '../../../../../src/plugins/typescript-go/middleware/unresolvedSvelteImports';
import { TemplateASTParseLoader } from '../../../../../src/plugins/svelte/TemplateASTLoader';
import {
    TsApiService,
    type TsApiAccess
} from '../../../../../src/plugins/typescript-go/TsApiService';
import { pathToUrl } from '../../../../../src/utils';
import {
    createTsApiServiceForTest,
    createTsGoServiceForTest,
    isSvelte5Plus,
    TsGoServiceSetupResult
} from '../../test-utils';

/**
 * Imports of missing `.svelte` files: TS7 resolves them to Svelte's ambient `declare module '*.svelte'`
 * and reports nothing, the middleware adds TypeScript's 2307 (`unresolvedSvelteImports.ts`).
 */
(isSvelte5Plus ? describe : describe.skip)(
    'content mapper: imports of missing .svelte files',
    function () {
        this.timeout(30_000);

        const fixtureDir = path.join(__dirname, 'unresolved-svelte-imports');
        const project = path.join(fixtureDir, 'project', 'src');
        const withAmbient = path.join(fixtureDir, 'with-ambient', 'src');

        let services: TsGoServiceSetupResult;
        let api: TsApiService;
        let transformer: TsgoResponseTransformer;

        before(async function () {
            this.timeout(60_000);
            services = await createTsGoServiceForTest([
                path.join(fixtureDir, 'project'),
                path.join(fixtureDir, 'with-ambient')
            ]);
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

        function open(file: string) {
            return services.docManager.openClientDocument({
                uri: pathToUrl(file),
                text: fs.readFileSync(file, 'utf-8')
            });
        }

        /** What the editor shows: TS7's report after the middleware */
        async function getDiagnostics(file: string): Promise<Diagnostic[]> {
            const params: DocumentDiagnosticParams = { textDocument: { uri: open(file).uri } };
            const raw = await services.service.sendRequest(DocumentDiagnosticRequest.type, params);
            const report = (await transformer.transform({
                method: DocumentDiagnosticRequest.method,
                params,
                result: raw
            })) as DocumentDiagnosticReport;
            assert.strictEqual(report.kind, 'full');
            return report.items;
        }

        const summarize = (diagnostics: Diagnostic[]) =>
            diagnostics
                .map(
                    (d) =>
                        `${d.range.start.line}:${d.range.start.character}-${d.range.end.line}:${d.range.end.character} ${d.code}`
                )
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        it('reports them like TypeScript, with comment directives applied', async () => {
            const diagnostics = await getDiagnostics(path.join(project, 'Ts.svelte'));
            assert.deepStrictEqual(summarize(diagnostics), [
                // export ... from './MissingReexport.svelte'
                '1:42-1:68 2307',
                // './Missing.svelte', 'not-installed/Comp.svelte'
                '6:24-6:42 2307',
                '7:20-7:47 2307',
                // the @ts-expect-error above './Child.svelte' is unused (the one above
                // './Expected.svelte' is used, the import below @ts-ignore is hidden)
                '12:4-12:23 2578'
            ]);
            const missing = diagnostics.find((d) => d.range.start.line === 6)!;
            assert.strictEqual(
                missing.message,
                "Cannot find module './Missing.svelte' or its corresponding type declarations."
            );
            assert.strictEqual(missing.source, 'ts');
        });

        it('like TypeScript, only in JavaScript that is checked', async () => {
            const unchecked = summarize(
                await getDiagnostics(path.join(project, 'JsUnchecked.svelte'))
            );
            const checked = summarize(await getDiagnostics(path.join(project, 'JsChecked.svelte')));
            assert.deepStrictEqual(unchecked, []);
            // TS checks it: the other error is there, too
            assert.deepStrictEqual(checked, ['2:24-2:42 2307', '4:6-4:14 2339']);
        });

        it('not with @ts-nocheck', async () => {
            assert.deepStrictEqual(await getDiagnostics(path.join(project, 'NoCheck.svelte')), []);
        });

        it('decides like TypeScript whether the file is checked (pragmas, script kind)', async () => {
            const summary = async (name: string) =>
                summarize(await getDiagnostics(path.join(project, `${name}.svelte`)));
            // a string that mentions a pragma isn't one
            assert.deepStrictEqual(await summary('NocheckString'), ['2:14-2:32 2307']);
            assert.deepStrictEqual(await summary('UncheckedCheckString'), []);
        });

        it('finds the directives also after a template literal with a substitution', async () => {
            const summary = async (name: string) =>
                summarize(await getDiagnostics(path.join(project, `${name}.svelte`)));
            // the real `// @ts-expect-error` above the re-export is used
            assert.deepStrictEqual(await summary('TemplateSingle'), []);
            // `// @ts-ignore` inside a template literal isn't a directive
            assert.deepStrictEqual(await summary('TemplateFake'), ['3:33-3:51 2307']);
        });

        it("doesn't ask TS7 when the text has no `.svelte`", async () => {
            const failing = {
                withSourceFile: () => assert.fail('asked TS7')
            } as unknown as TsApiAccess;
            for (const uri of ['file:///a/A.svelte', 'file:///a/a.ts']) {
                const text = "import x from './x';";
                assert.deepStrictEqual(await findUnresolvedSvelteImports(failing, uri, text), []);
            }
        });

        it("not when the project declares `module '*.svelte'` itself", async () => {
            assert.deepStrictEqual(await getDiagnostics(path.join(withAmbient, 'App.svelte')), []);
        });

        it('finds them in TypeScript files, too (for svelte-check)', async () => {
            const file = path.join(project, 'main.ts');
            open(file);
            const diagnostics = await findUnresolvedSvelteImports(
                api,
                pathToUrl(file),
                fs.readFileSync(file, 'utf-8')
            );
            assert.deepStrictEqual(summarize(diagnostics ?? []), ['1:20-1:38 2307']);
        });
    }
);
