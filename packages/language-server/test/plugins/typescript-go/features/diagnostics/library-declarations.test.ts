import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { Diagnostic, DocumentDiagnosticRequest } from 'vscode-languageserver';
import { TsApiService } from '../../../../../src/plugins/typescript-go/TsApiService';
import { pathToUrl } from '../../../../../src/utils';
import {
    createTsApiServiceForTest,
    createTsGoServiceForTest,
    isSvelte5Plus,
    TsGoServiceSetupResult
} from '../../test-utils';

/**
 * Libraries that ship `.svelte` files next to their declarations (`library-declarations/node_modules/my-lib/dist`),
 * imported through the library's barrel (`index.d.ts`, via the `types` condition of its exports map):
 * - `Foo.svelte` + `Foo.svelte.d.ts` (what `@sveltejs/package` emits)
 * - `Bar.svelte` + `Bar.d.svelte.ts` (the name TS expects for declarations of `Bar.svelte`)
 * - `NoTypes.svelte` without declarations
 * The sources type `name` as a number (and have an error inside), the declarations as a string.
 * Only the language server (TS7's LSP and API) and this barrel layout are covered: not deep imports
 * (`my-lib/Foo.svelte`), workspace packages linked into `node_modules`, or `tsc`.
 *
 * KNOWN GAP, pinned down here: with the mapper registered for `.svelte`, TS7 resolves
 * `./Foo.svelte` in the library's `index.d.ts` to the source, not to the declarations next to it.
 * So library sources are transformed and type checked as part of the project (errors in
 * `node_modules`), and they decide the types users see. A content mapper `include` doesn't help:
 * TS then drops the source (TS18140) without falling back to the declarations, and the import
 * becomes the ambient `*.svelte` module type. See the upstream change request (resolver fallback
 * for unclaimed files).
 *
 * When that's fixed, set `DECLARATIONS_ARE_USED` to true (and add the `include` to the fixture's
 * tsconfig if the fix needs it). The expectations that switch are about the consumer only: its
 * diagnostics, and which library files its program contains. A library source opened as a document
 * is a separate case (last test), with an expectation that doesn't depend on the fix.
 */
const DECLARATIONS_ARE_USED = false;

const fixtureDir = path.join(__dirname, 'library-declarations');
const appFile = path.join(fixtureDir, 'src', 'App.svelte');
const libDir = 'node_modules/my-lib/dist';

/** `line:character code` (0-based, like LSP), the message is TS's and not of interest here */
type Summary = string;

const expected = DECLARATIONS_ARE_USED
    ? {
          consumer: [] as Summary[],
          // the declarations type Foo and Bar, NoTypes has only its source
          programLibraryFiles: [
              `${libDir}/Bar.d.svelte.ts`,
              `${libDir}/Foo.svelte.d.ts`,
              `${libDir}/NoTypes.svelte`,
              `${libDir}/index.d.ts`
          ],
          libraryErrors: { [`${libDir}/NoTypes.svelte`]: 0 } as Record<string, number>
      }
    : {
          // Foo and Bar are typed by their sources: `name: 'foo'` is wrong, `name: 1` right
          consumer: ['5:53 2322', '6:4 2578', '10:53 2322', '11:4 2578', '20:5 2322', '21:5 2322'],
          // the sources instead of the declarations
          programLibraryFiles: [
              `${libDir}/Bar.svelte`,
              `${libDir}/Foo.svelte`,
              `${libDir}/NoTypes.svelte`,
              `${libDir}/index.d.ts`
          ],
          // and their errors are errors of the project
          libraryErrors: {
              [`${libDir}/Bar.svelte`]: 1,
              [`${libDir}/Foo.svelte`]: 1,
              [`${libDir}/NoTypes.svelte`]: 0
          } as Record<string, number>
      };
const gap = DECLARATIONS_ARE_USED ? '' : ' (known gap)';

(isSvelte5Plus ? describe : describe.skip)(
    'content mapper: libraries with declarations next to their .svelte files',
    function () {
        this.timeout(30_000);

        let services: TsGoServiceSetupResult;
        let api: TsApiService;

        before(async function () {
            this.timeout(60_000);
            services = await createTsGoServiceForTest(fixtureDir);
            api = await createTsApiServiceForTest(services.service, services.lsConfigManager);
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

        async function getDiagnostics(file: string): Promise<Diagnostic[]> {
            const report = await services.service.sendRequest(DocumentDiagnosticRequest.type, {
                textDocument: { uri: open(file).uri }
            });
            assert.strictEqual(report.kind, 'full');
            return report.items;
        }

        const summarize = (diagnostics: Diagnostic[]): Summary[] =>
            diagnostics
                .map((d) => `${d.range.start.line}:${d.range.start.character} ${d.code}`)
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        const relative = (file: string) => path.relative(fixtureDir, file).replace(/\\/g, '/');

        it(`types the library's components in the consumer${gap}`, async () => {
            assert.deepStrictEqual(summarize(await getDiagnostics(appFile)), expected.consumer);
        });

        it(`puts these library files into the consumer's program${gap}`, async () => {
            // only the consumer is open; library files get into the program through its imports
            const files = await api.withProject(pathToUrl(appFile), async (project) => {
                const names = await project.program.getSourceFileNames();
                return names.map(relative).filter((name) => name.startsWith(libDir));
            });
            assert.deepStrictEqual([...(files ?? [])].sort(), expected.programLibraryFiles);
        });

        it(`reports errors in library sources as errors of the project${gap}`, async () => {
            const counts = await api.withProject(pathToUrl(appFile), async (project) => {
                const result: Record<string, number> = {};
                for (const file of Object.keys(expected.libraryErrors)) {
                    const fileName = path.join(fixtureDir, file);
                    result[file] = (
                        await project.program.getSemanticDiagnostics([fileName])
                    ).length;
                }
                return result;
            });
            assert.deepStrictEqual(counts, expected.libraryErrors);
        });

        it('a library component without declarations is typed by its source', async () => {
            // part of both expectations: `count: 'one'` is an error (used @ts-expect-error),
            // `<NoTypes count={1} />` is fine
            const diagnostics = summarize(await getDiagnostics(appFile));
            assert.ok(!diagnostics.includes('16:4 2578'), diagnostics.join(', '));
            assert.ok(!diagnostics.some((d) => d.startsWith('22:')), diagnostics.join(', '));
        });

        // Last: opening it changes which files are open in the session
        it('checks a library source that is opened as a document, like any source', async () => {
            // Independent of `DECLARATIONS_ARE_USED`: an opened file with an error shows it
            assert.deepStrictEqual(
                summarize(await getDiagnostics(path.join(fixtureDir, libDir, 'Foo.svelte'))),
                ['2:10 2322']
            );
        });
    }
);
