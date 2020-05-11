import { join } from 'path';
import ts from 'typescript';
import assert from 'assert';

import { DocumentManager, TextDocument, ManagedDocument } from '../../../../src/lib/documents';
import { pathToUrl } from '../../../../src/utils';
import { CompletionItem, CompletionItemKind, Position, Range } from 'vscode-languageserver';
import { rmdirSync, mkdirSync } from 'fs';
import { CompletionsProviderImpl } from '../../../../src/plugins/typescript/features/CompletionProvider';
import { LSAndTSDocResovler } from '../../../../src/plugins/typescript/LSAndTSDocResovler';

const testFilesDir = join(__dirname, '..', 'testfiles');
const newLine = ts.sys.newLine;

describe('CompletionProviderImpl', () => {
    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new ManagedDocument(textDocument.uri, textDocument.text),
        );
        const lsAndTsDocResolver = new LSAndTSDocResovler(docManager);
        const completionProvider = new CompletionsProviderImpl(lsAndTsDocResolver);
        const filePath = join(testFilesDir, filename);
        const document = new TextDocument(pathToUrl(filePath), ts.sys.readFile(filePath)!);
        docManager.openDocument(<any>{ uri: document.uri, text: document.getText() });
        return { completionProvider, document, docManager };
    }

    it('provides completions', async () => {
        const { completionProvider, document } = setup('completions.svelte');

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(0, 49),
            '.',
        );

        assert.ok(
            Array.isArray(completions && completions.items),
            'Expected completion items to be an array',
        );
        assert.ok(completions!.items.length > 0, 'Expected completions to have length');

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { data, ...withoutData } = completions!.items[0];

        assert.deepStrictEqual(withoutData, <CompletionItem>{
            label: 'b',
            insertText: undefined,
            kind: CompletionItemKind.Method,
            sortText: '0',
            commitCharacters: ['.', ',', '('],
            preselect: undefined,
        });
    })
        // initial build might take longer
        .timeout(8000);

    it('does not provide completions inside style tag', async () => {
        const { completionProvider, document } = setup('completionsstyle.svelte');

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(4, 1),
            'a',
        );

        assert.ok(completions === null, 'Expected completion to be null');
    });

    it('provides completion resolve info', async () => {
        const { completionProvider, document } = setup('completions.svelte');

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(0, 49),
            '.',
        );

        const { data } = completions!.items[0];

        // uri would not be the same, so only check if exist;
        assert.notEqual(data, null);
        const { uri, ...withoutUri } = data!;
        assert.ok(uri);

        assert.deepStrictEqual(withoutUri, {
            hasAction: undefined,
            insertText: undefined,
            isRecommended: undefined,
            kind: 'method',
            kindModifiers: '',
            name: 'b',
            position: {
                character: 49,
                line: 0,
            },
            replacementSpan: undefined,
            sortText: '0',
            source: undefined,
        });
    });

    it('resolve completion and provide documentation', async () => {
        const { completionProvider, document } = setup('documentation.svelte');

        const { documentation, detail } = await completionProvider.resolveCompletion(document, {
            label: 'foo',
            kind: 6,
            commitCharacters: ['.', ',', '('],
            data: {
                name: 'foo',
                kind: ts.ScriptElementKind.alias,
                sortText: '0',
                uri: '',
                position: Position.create(3, 7),
            },
        });

        assert.deepStrictEqual(detail, '(alias) function foo(): boolean\nimport foo');
        assert.deepStrictEqual(documentation, 'bars');
    });

    it('provides import completions for directory', async () => {
        const { completionProvider, document } = setup('importcompletions.svelte');
        const mockDirName = 'foo';
        const mockDirPath = join(testFilesDir, mockDirName);

        mkdirSync(mockDirPath);

        try {
            const completions = await completionProvider.getCompletions(
                document,
                Position.create(0, 27),
                '/',
            );
            const mockedDirImportCompletion = completions?.items.find(
                (item) => item.label === mockDirName,
            );

            assert.notEqual(
                mockedDirImportCompletion,
                undefined,
                `can't provide completions on directory`,
            );
            assert.equal(mockedDirImportCompletion?.kind, CompletionItemKind.Folder);
        } finally {
            rmdirSync(mockDirPath);
        }
    });

    it('resolve auto import completion (is first import in file)', async () => {
        const { completionProvider, document } = setup('importcompletions1.svelte');

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(1, 3),
        );
        document.version++;

        const item = completions?.items.find((item) => item.label === 'blubb');

        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);

        const { additionalTextEdits, detail } = await completionProvider.resolveCompletion(
            document,
            item!,
        );

        assert.strictEqual(detail, 'Auto import from ./definitions\nfunction blubb(): boolean');

        assert.strictEqual(
            additionalTextEdits![0]?.newText,
            // " instead of ' because VSCode uses " by default when there are no other imports indicating otherwise
            `${newLine}import { blubb } from "./definitions";${newLine}${newLine}`,
        );

        assert.deepEqual(
            additionalTextEdits![0]?.range,
            Range.create(Position.create(0, 8), Position.create(0, 8)),
        );
    });

    it('resolve auto import completion (is second import in file)', async () => {
        const { completionProvider, document } = setup('importcompletions2.svelte');

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(2, 3),
        );
        document.version++;

        const item = completions?.items.find((item) => item.label === 'blubb');

        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);

        const { additionalTextEdits, detail } = await completionProvider.resolveCompletion(
            document,
            item!,
        );

        assert.strictEqual(detail, 'Auto import from ./definitions\nfunction blubb(): boolean');

        assert.strictEqual(
            additionalTextEdits![0]?.newText,
            `import { blubb } from './definitions';${newLine}`,
        );

        assert.deepEqual(
            additionalTextEdits![0]?.range,
            Range.create(Position.create(2, 0), Position.create(2, 0)),
        );
    });

    it('resolve auto import completion (importing in same line as first import)', async () => {
        const { completionProvider, document } = setup('importcompletions3.svelte');

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(0, 42),
        );
        document.version++;

        const item = completions?.items.find((item) => item.label === 'blubb');

        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);

        const { additionalTextEdits, detail } = await completionProvider.resolveCompletion(
            document,
            item!,
        );

        assert.strictEqual(detail, 'Auto import from ./definitions\nfunction blubb(): boolean');

        assert.strictEqual(
            additionalTextEdits![0]?.newText,
            `import { blubb } from './definitions';${newLine}`,
        );

        assert.deepEqual(
            additionalTextEdits![0]?.range,
            Range.create(Position.create(1, 0), Position.create(1, 0)),
        );
    });

    async function openFileToBeImported(
        docManager: DocumentManager,
        completionProvider: CompletionsProviderImpl,
    ) {
        const filePath = join(testFilesDir, 'imported-file.svelte');
        const hoverinfoDoc = new TextDocument(pathToUrl(filePath), ts.sys.readFile(filePath) || '');
        docManager.openDocument(<any>hoverinfoDoc);
        await completionProvider.getCompletions(hoverinfoDoc, Position.create(1, 1));
    }

    it('resolve auto import completion (importing a svelte component)', async () => {
        const { completionProvider, document, docManager } = setup('importcompletions4.svelte');
        // make sure that the ts language service does know about the imported-file file
        await openFileToBeImported(docManager, completionProvider);

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(2, 7),
        );
        document.version++;

        const item = completions?.items.find((item) => item.label === 'ImportedFile');

        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);

        const { additionalTextEdits, detail } = await completionProvider.resolveCompletion(
            document,
            item!,
        );

        assert.strictEqual(detail, 'Auto import from ./imported-file.svelte\nclass default');

        assert.strictEqual(
            additionalTextEdits![0]?.newText,
            // " instead of ' because VSCode uses " by default when there are no other imports indicating otherwise
            `${newLine}import ImportedFile from "./imported-file.svelte";${newLine}`,
        );

        assert.deepEqual(
            additionalTextEdits![0]?.range,
            Range.create(Position.create(0, 8), Position.create(0, 8)),
        );
    })
        // this might take longer
        .timeout(4000);

    it('resolve auto import completion (importing a svelte component, no script tag yet)', async () => {
        const { completionProvider, document, docManager } = setup('importcompletions5.svelte');
        // make sure that the ts language service does know about the imported-file file
        await openFileToBeImported(docManager, completionProvider);

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(0, 7),
        );
        document.version++;

        const item = completions?.items.find((item) => item.label === 'ImportedFile');

        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);

        const { additionalTextEdits, detail } = await completionProvider.resolveCompletion(
            document,
            item!,
        );

        assert.strictEqual(detail, 'Auto import from ./imported-file.svelte\nclass default');

        assert.strictEqual(
            additionalTextEdits![0]?.newText,
            // " instead of ' because VSCode uses " by default when there are no other imports indicating otherwise
            `<script>${newLine}import ImportedFile from "./imported-file.svelte";` +
                `${newLine}${newLine}</script>${newLine}`,
        );

        assert.deepEqual(
            additionalTextEdits![0]?.range,
            Range.create(Position.create(0, 0), Position.create(0, 0)),
        );
    })
        // this might take longer
        .timeout(4000);

    it('resolve auto completion without auto import (a svelte component which was already imported)', async () => {
        const { completionProvider, document, docManager } = setup('importcompletions6.svelte');
        // make sure that the ts language service does know about the imported-file file
        await openFileToBeImported(docManager, completionProvider);

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(3, 7),
        );
        document.version++;

        const item = completions?.items.find((item) => item.label === 'ImportedFile');

        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);

        const { additionalTextEdits } = await completionProvider.resolveCompletion(document, item!);

        assert.strictEqual(additionalTextEdits, undefined);
    })
        // this might take longer
        .timeout(4000);
});
