import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
    CompletionItem,
    CompletionList,
    CompletionRequest,
    DocumentDiagnosticRequest
} from 'vscode-languageserver';
import { pathToUrl } from '../../../../src/utils';
import { setupSharedServices } from '../test-utils';

const testDir = path.join(__dirname, '..', 'testfiles', 'completions');

/**
 * Prop names of a component while typing them (`<Child v|`): svelte2tsx keeps attribute names
 * verbatim in the span map, also one-character ones, so TS7 maps the position exactly and offers the
 * props from the component's type
 */
describe('Component prop completions (TS GO)', function () {
    const getServices = setupSharedServices(testDir);

    function open() {
        const filePath = path.join(testDir, 'Props.svelte');
        return getServices().docManager.openClientDocument({
            uri: pathToUrl(filePath),
            text: fs.readFileSync(filePath, 'utf-8')
        });
    }

    async function labelsAt(line: number, character: number) {
        const document = open();
        const result = await getServices().service.sendRequest(CompletionRequest.type, {
            textDocument: { uri: document.uri },
            position: { line, character },
            context: { triggerKind: 1 }
        });
        const items: CompletionItem[] = Array.isArray(result)
            ? result
            : ((result as CompletionList | null)?.items ?? []);
        return items.map((item) => item.label).sort();
    }

    it('offers the props after the first letter of a prop name', async () => {
        // <Child v|
        assert.deepStrictEqual(await labelsAt(4, 8), ['value', 'verbose']);
    });

    it('offers the props before an attribute value', async () => {
        // <Child v|={1}
        assert.deepStrictEqual(await labelsAt(5, 8), ['value', 'verbose']);
    });

    it('still reports unknown one-letter props on their name', async () => {
        const document = open();
        const report = await getServices().service.sendRequest(DocumentDiagnosticRequest.type, {
            textDocument: { uri: document.uri }
        });
        assert.strictEqual(report.kind, 'full');
        // `v` and `x` aren't props of Child: reported on the name, which is one character
        const unknown = report.items.filter((d) => d.code === 2353);
        assert.deepStrictEqual(
            unknown.map(
                (d) =>
                    `${d.range.start.line}:${d.range.start.character}-${d.range.end.line}:${d.range.end.character}`
            ),
            ['4:7-4:8', '5:7-5:8', '6:7-6:8']
        );
    });
});
