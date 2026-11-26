import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
    DocumentFormattingRequest,
    DocumentRangeFormattingRequest,
    DocumentOnTypeFormattingRequest
} from 'vscode-languageserver';
import { pathToUrl } from '../../../../src/utils';
import { setupSharedServices } from '../test-utils';

const testDir = path.join(__dirname, '..', 'testfiles', 'formatting');

/**
 * TS7 would format a `.svelte` file through its virtual code (svelte2tsx output) and map the edits
 * back: script indentation removed, `{count}` turned into `{ count}`. svelte2tsx's span map turns the
 * Formatting feature off, so TS7 returns no edits, also for clients without our middleware.
 */
describe('Formatting (TS GO)', function () {
    const getServices = setupSharedServices(testDir);

    function open() {
        const filePath = path.join(testDir, 'Formatting.svelte');
        const text = fs.readFileSync(filePath, 'utf-8');
        return getServices().docManager.openClientDocument({ uri: pathToUrl(filePath), text });
    }

    const options = { tabSize: 4, insertSpaces: true };

    it('returns no edits for a whole Svelte file', async () => {
        const document = open();
        const edits = await getServices().service.sendRequest(DocumentFormattingRequest.type, {
            textDocument: { uri: document.uri },
            options
        });
        assert.deepStrictEqual(edits ?? [], []);
    });

    it('returns no edits for a range or on typing', async () => {
        const document = open();
        const range = await getServices().service.sendRequest(DocumentRangeFormattingRequest.type, {
            textDocument: { uri: document.uri },
            range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
            options
        });
        assert.deepStrictEqual(range ?? [], []);
        const onType = await getServices().service.sendRequest(
            DocumentOnTypeFormattingRequest.type,
            {
                textDocument: { uri: document.uri },
                position: { line: 4, character: 5 },
                ch: '}',
                options
            }
        );
        assert.deepStrictEqual(onType ?? [], []);
    });
});
