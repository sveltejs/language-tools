import { join } from 'path';
import ts from 'typescript';
import assert from 'assert';

import { DocumentManager, TextDocument } from '../../../../src/lib/documents';
import { pathToUrl } from '../../../../src/utils';
import { CompletionItem, CompletionItemKind, Position, CompletionTriggerKind } from 'vscode-languageserver';
import { rmdirSync, mkdirSync } from 'fs';
import {
    CompletionsProviderImpl
} from '../../../../src/plugins/typescript/features/CompletionProvider';
import { LSAndTSDocResovler } from '../../../../src/plugins/typescript/LSAndTSDocResovler';

const testFilesDir = join(__dirname, '..', 'testfiles');

describe('CompletionProviderImpl', () => {
    function setup(filename: string) {
        const docManager = new DocumentManager(() => document);
        const lsAndTsDocResolver = new LSAndTSDocResovler(docManager);
        const completionProvider = new CompletionsProviderImpl(lsAndTsDocResolver);
        const filePath = join(testFilesDir, filename);
        const document = new TextDocument(pathToUrl(filePath), ts.sys.readFile(filePath)!);
        docManager.openDocument(<any>'some doc');
        return { completionProvider, document };
    }


    it('provides completions', async () => {


        const { completionProvider, document } = setup('completions.svelte');

        const completions = completionProvider.getCompletions(document, Position.create(0, 49), {
            triggerKind: CompletionTriggerKind.TriggerCharacter,
            triggerCharacter: '.'
        });

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

    it('provides completion resolve info', async () => {
        const { completionProvider, document } = setup('completions.svelte');

        const completions = completionProvider.getCompletions(document, Position.create(0, 49), {
            triggerKind: CompletionTriggerKind.TriggerCharacter,
            triggerCharacter: '.'
        });

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
                line: 0
            },
            replacementSpan: undefined,
            sortText: '0',
            source: undefined,
        });
    });

    it('resolve completion and provide documentation', async () => {
        const { completionProvider, document } = setup('documentation.svelte');

        const completions = completionProvider.getCompletions(document, Position.create(4, 8), {
            triggerKind: CompletionTriggerKind.Invoked,
            triggerCharacter: 'o'
        });

        const { documentation, detail } = await completionProvider.resolveCompletion(
            document,
            completions?.items[0]!
        );

        assert.deepStrictEqual(detail, '(alias) function foo(): boolean\nimport foo');
        assert.deepStrictEqual(documentation, 'bars');
    });

    it('provides import completions for directory', async () => {
        const { completionProvider, document } = setup('importcompletions.svelte');
        const mockDirName = 'foo';
        const mockDirPath = join(testFilesDir, mockDirName);

        mkdirSync(mockDirPath);

        try {
            const completions = completionProvider.getCompletions(
                document, Position.create(0, 27), {
                triggerKind: CompletionTriggerKind.TriggerCharacter,
                triggerCharacter: '/'
            });
            const mockedDirImportCompletion = completions?.items
                .find(item => item.label === mockDirName);

            assert.notEqual(
                mockedDirImportCompletion,
                undefined,
                `can't provides completions on directory`
            );
            assert.equal(mockedDirImportCompletion?.kind, CompletionItemKind.Folder);
        } finally {
            rmdirSync(mockDirPath);
        }
    });

    it('resolve auto import completion', async () => {
        const { completionProvider, document } = setup('importcompletions.svelte');

        const completions = completionProvider.getCompletions(document, Position.create(0, 40));
        document.version++;

        const item = completions?.items.find(item => item.label === 'blubb');

        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);

        const {
            additionalTextEdits,
            detail
        } = await completionProvider.resolveCompletion(document, item!);

        assert.strictEqual(detail, 'Auto import from ./definitions\nfunction blubb(): boolean');

        assert.strictEqual(
            additionalTextEdits![0]?.newText.replace('\r', '').replace('\n', ''),
            `import { blubb } from './definitions'`,
        );
    });
});
