import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { DocumentDiagnosticRequest } from 'vscode-languageserver';
import { pathToUrl } from '../../../../../src/utils';
import { isSvelte5Plus, setupSharedServices } from '../../test-utils';

const testDir = path.join(__dirname, '..', '..', 'testfiles', 'bindings');

/**
 * TS7 alone (no middleware, like `tsc` or other editors): svelte2tsx maps the generated
 * `$$_child.$$bindings = 'readonly'` to the `bind:` directive, so the error of a `bind:` on a prop
 * that isn't `$bindable()` is reported there, with TypeScript's message. Without the mapping it's in
 * unmapped virtual code (an 18080 at the start of the file).
 */
(isSvelte5Plus ? describe : describe.skip)(
    'bind: on a non-bindable prop (TS GO, raw)',
    function () {
        const getServices = setupSharedServices(testDir);

        it('is reported on the directive', async () => {
            const filePath = path.join(testDir, 'Parent.svelte');
            const { docManager, service } = getServices();
            const document = docManager.openClientDocument({
                uri: pathToUrl(filePath),
                text: fs.readFileSync(filePath, 'utf-8')
            });
            const report = await service.sendRequest(DocumentDiagnosticRequest.type, {
                textDocument: { uri: document.uri }
            });
            assert.strictEqual(report.kind, 'full');
            assert.deepStrictEqual(
                report.items.map((d) => ({ code: d.code, range: d.range, message: d.message })),
                [
                    {
                        code: 2322,
                        // bind:readonly={v}
                        range: {
                            start: { line: 5, character: 22 },
                            end: { line: 5, character: 39 }
                        },
                        message: `Type '"readonly"' is not assignable to type '"value"'.`
                    }
                ]
            );
        });
    }
);
