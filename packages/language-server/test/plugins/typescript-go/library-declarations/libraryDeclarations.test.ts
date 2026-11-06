import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
    DefinitionRequest,
    Diagnostic,
    DocumentDiagnosticRequest,
    LocationLink,
    Position
} from 'vscode-languageserver';
import { pathToUrl } from '../../../../src/utils';
import { createTsGoServiceForTest, TsGoServiceSetupResult } from '../test-utils';

const fixtureDir = path.join(__dirname, 'fixture');
const libDir = path.join(fixtureDir, 'node_modules', 'my-lib', 'dist');
const appFile = path.join(fixtureDir, 'src', 'App.svelte');

describe('content mapper: declarations next to .svelte files in node_modules', function () {
    this.timeout(20_000);

    let services: TsGoServiceSetupResult;

    before(async () => {
        services = await createTsGoServiceForTest(fixtureDir, {
            textDocument: { definition: { linkSupport: true } }
        });
    });

    after(() => {
        services?.service.dispose();
    });

    function open(file: string) {
        return services.docManager.openClientDocument({
            uri: pathToUrl(file),
            text: fs.readFileSync(file, 'utf-8')
        });
    }

    async function getDiagnostics(file: string): Promise<Diagnostic[]> {
        const document = open(file);
        const report = await services.service.sendRequest(DocumentDiagnosticRequest.type, {
            textDocument: { uri: document.uri }
        });
        assert.strictEqual(report.kind, 'full');
        return report.items;
    }

    /** Position of the first `needle` in `file`, plus `delta` characters */
    function positionOf(file: string, needle: string, delta = 0): Position {
        const text = fs.readFileSync(file, 'utf-8');
        const index = text.indexOf(needle);
        assert.ok(index !== -1, `${needle} not found in ${file}`);
        const offset = index + delta;
        const before = text.slice(0, offset);
        const line = before.split('\n').length - 1;
        return Position.create(line, offset - (before.lastIndexOf('\n') + 1));
    }

    it('types library components with the declarations next to them', async () => {
        // App.svelte has `@ts-expect-error` where the declarations disagree with the sources,
        // so falling back to the sources reports errors there
        assert.deepStrictEqual(await getDiagnostics(appFile), []);
    });

    it("doesn't check library sources that have declarations", async () => {
        assert.deepStrictEqual(await getDiagnostics(path.join(libDir, 'Foo.svelte')), []);
        assert.deepStrictEqual(await getDiagnostics(path.join(libDir, 'Bar.svelte')), []);
    });

    for (const component of ['Foo', 'Bar']) {
        it(`goes to the definition of ${component} in its .svelte file`, async () => {
            const document = open(appFile);
            const definitions = await services.service.sendRequest(DefinitionRequest.type, {
                textDocument: { uri: document.uri },
                position: positionOf(
                    appFile,
                    `ComponentProps<${component}>`,
                    'ComponentProps<'.length
                )
            });

            const start = Position.create(0, 0);
            assert.ok(Array.isArray(definitions) && definitions.every(LocationLink.is));
            assert.deepStrictEqual(
                definitions.map((definition) => ({
                    uri: definition.targetUri,
                    range: definition.targetSelectionRange
                })),
                [
                    {
                        uri: pathToUrl(path.join(libDir, `${component}.svelte`)),
                        range: { start, end: start }
                    }
                ]
            );
        });
    }
});
