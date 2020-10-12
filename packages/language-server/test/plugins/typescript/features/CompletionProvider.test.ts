import { join, extname } from 'path';
import ts from 'typescript';
import assert from 'assert';
import { rmdirSync, mkdirSync, readdirSync } from 'fs';

import { DocumentManager, Document } from '../../../../src/lib/documents';
import { pathToUrl } from '../../../../src/utils';
import {
    CompletionItem,
    CompletionItemKind,
    Position,
    Range,
    CompletionTriggerKind,
    MarkupKind
} from 'vscode-languageserver';
import {
    CompletionsProviderImpl,
    CompletionEntryWithIdentifer
} from '../../../../src/plugins/typescript/features/CompletionProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { sortBy } from 'lodash';

const testDir = join(__dirname, '..');
const testFilesDir = join(testDir, 'testfiles', 'completions');
const newLine = ts.sys.newLine;

const fileNameToAbosoluteUri = (file: string) => {
    return pathToUrl(join(testFilesDir, file));
};

describe('CompletionProviderImpl', () => {
    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );
        const lsAndTsDocResolver = new LSAndTSDocResolver(docManager, [pathToUrl(testDir)]);
        const completionProvider = new CompletionsProviderImpl(lsAndTsDocResolver);
        const filePath = join(testFilesDir, filename);
        const document = docManager.openDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath) || ''
        });
        return { completionProvider, document, docManager };
    }

    it('provides completions', async () => {
        const { completionProvider, document } = setup('completions.svelte');

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(0, 49),
            {
                triggerKind: CompletionTriggerKind.TriggerCharacter,
                triggerCharacter: '.'
            }
        );

        assert.ok(
            Array.isArray(completions && completions.items),
            'Expected completion items to be an array'
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
            preselect: undefined
        });
    });

    it('provides event completions', async () => {
        const { completionProvider, document } = setup('component-events-completion.svelte');

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(4, 5),
            {
                triggerKind: CompletionTriggerKind.Invoked
            }
        );

        assert.ok(
            Array.isArray(completions && completions.items),
            'Expected completion items to be an array'
        );
        assert.ok(completions!.items.length > 0, 'Expected completions to have length');

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const eventCompletions = completions!.items.filter((item) => item.label.startsWith('on:'));

        assert.deepStrictEqual(eventCompletions, <CompletionItem[]>[
            {
                detail: 'a: CustomEvent<boolean>',
                documentation: undefined,
                label: 'on:a',
                sortText: '-1'
            },
            {
                detail: 'b: MouseEvent',
                documentation: {
                    kind: 'markdown',
                    value: '\nTEST\n'
                },
                label: 'on:b',
                sortText: '-1'
            },
            {
                detail: 'c: Event',
                documentation: undefined,
                label: 'on:c',
                sortText: '-1'
            }
        ]);
    });

    it('does not provide completions inside style tag', async () => {
        const { completionProvider, document } = setup('completionsstyle.svelte');

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(4, 1),
            {
                triggerKind: CompletionTriggerKind.Invoked,
                triggerCharacter: 'a'
            }
        );

        assert.ok(completions === null, 'Expected completion to be null');
    });

    it('provides completion resolve info', async () => {
        const filename = 'completions.svelte';
        const { completionProvider, document } = setup(filename);

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(0, 49),
            {
                triggerKind: CompletionTriggerKind.TriggerCharacter,
                triggerCharacter: '.'
            }
        );

        const { data } = completions!.items[0];

        assert.deepStrictEqual(data, {
            hasAction: undefined,
            insertText: undefined,
            isPackageJsonImport: undefined,
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
            uri: fileNameToAbosoluteUri(filename)
        } as CompletionEntryWithIdentifer);
    });

    it('resolve completion and provide documentation', async () => {
        const { completionProvider, document } = setup('../documentation.svelte');

        const { documentation, detail } = await completionProvider.resolveCompletion(document, {
            label: 'foo',
            kind: 6,
            commitCharacters: ['.', ',', '('],
            data: {
                name: 'foo',
                kind: ts.ScriptElementKind.alias,
                sortText: '0',
                uri: '',
                position: Position.create(3, 7)
            }
        });

        assert.deepStrictEqual(detail, '(alias) function foo(): boolean\nimport foo');
        assert.deepStrictEqual(documentation, { value: 'bars', kind: MarkupKind.Markdown });
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
                {
                    triggerKind: CompletionTriggerKind.TriggerCharacter,
                    triggerCharacter: '/'
                }
            );
            const mockedDirImportCompletion = completions?.items.find(
                (item) => item.label === mockDirName
            );

            assert.notEqual(
                mockedDirImportCompletion,
                undefined,
                'can\'t provide completions on directory'
            );
            assert.equal(mockedDirImportCompletion?.kind, CompletionItemKind.Folder);
        } finally {
            rmdirSync(mockDirPath);
        }
    });

    it('provides import completions for supported files', async () => {
        const sourceFile = 'importcompletions.svelte';
        const { completionProvider, document } = setup(sourceFile);
        const supportedExtensions = [
            ts.Extension.Js,
            ts.Extension.Ts,
            ts.Extension.Dts,
            ts.Extension.Jsx,
            ts.Extension.Tsx,
            ts.Extension.Json,
            '.svelte'
        ];
        const ignores = ['tsconfig.json', sourceFile];

        const testfiles = readdirSync(testFilesDir, { withFileTypes: true })
            .filter(
                (f) =>
                    f.isDirectory() ||
                    (supportedExtensions.includes(extname(f.name)) && !ignores.includes(f.name))
            )
            .map((f) => f.name);

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(0, 27),
            {
                triggerKind: CompletionTriggerKind.TriggerCharacter,
                triggerCharacter: '/'
            }
        );

        assert.deepStrictEqual(
            sortBy(
                completions?.items.map((item) => item.label),
                (x) => x
            ),
            sortBy(testfiles, (x) => x)
        );
    });

    it('resolve auto import completion (is first import in file)', async () => {
        const { completionProvider, document } = setup('importcompletions1.svelte');

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(1, 3)
        );
        document.version++;

        const item = completions?.items.find((item) => item.label === 'blubb');

        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);

        const { additionalTextEdits, detail } = await completionProvider.resolveCompletion(
            document,
            item!
        );

        assert.strictEqual(detail, 'Auto import from ../definitions\nfunction blubb(): boolean');

        assert.strictEqual(
            harmonizeNewLines(additionalTextEdits![0]?.newText),
            // " instead of ' because VSCode uses " by default when there are no other imports indicating otherwise
            `${newLine}import { blubb } from "../definitions";${newLine}${newLine}`
        );

        assert.deepEqual(
            additionalTextEdits![0]?.range,
            Range.create(Position.create(0, 8), Position.create(0, 8))
        );
    });

    it('resolve auto import completion (is second import in file)', async () => {
        const { completionProvider, document } = setup('importcompletions2.svelte');

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(2, 3)
        );
        document.version++;

        const item = completions?.items.find((item) => item.label === 'blubb');

        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);

        const { additionalTextEdits, detail } = await completionProvider.resolveCompletion(
            document,
            item!
        );

        assert.strictEqual(detail, 'Auto import from ../definitions\nfunction blubb(): boolean');

        assert.strictEqual(
            harmonizeNewLines(additionalTextEdits![0]?.newText),
            `import { blubb } from '../definitions';${newLine}`
        );

        assert.deepEqual(
            additionalTextEdits![0]?.range,
            Range.create(Position.create(2, 0), Position.create(2, 0))
        );
    });

    it('resolve auto import completion (importing in same line as first import)', async () => {
        const { completionProvider, document } = setup('importcompletions3.svelte');

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(0, 42)
        );
        document.version++;

        const item = completions?.items.find((item) => item.label === 'blubb');

        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);

        const { additionalTextEdits, detail } = await completionProvider.resolveCompletion(
            document,
            item!
        );

        assert.strictEqual(detail, 'Auto import from ../definitions\nfunction blubb(): boolean');

        assert.strictEqual(
            harmonizeNewLines(additionalTextEdits![0]?.newText),
            `${newLine}import { blubb } from '../definitions';${newLine}`
        );

        assert.deepEqual(
            additionalTextEdits![0]?.range,
            Range.create(Position.create(0, 8), Position.create(0, 8))
        );
    });

    async function openFileToBeImported(
        docManager: DocumentManager,
        completionProvider: CompletionsProviderImpl,
        name = 'imported-file.svelte'
    ) {
        const filePath = join(testFilesDir, name);
        const hoverinfoDoc = docManager.openDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath) || ''
        });
        await completionProvider.getCompletions(hoverinfoDoc, Position.create(1, 1));
    }

    it('resolve auto import completion (importing a svelte component)', async () => {
        const { completionProvider, document, docManager } = setup('importcompletions4.svelte');
        // make sure that the ts language service does know about the imported-file file
        await openFileToBeImported(docManager, completionProvider);

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(2, 7)
        );
        document.version++;

        const item = completions?.items.find((item) => item.label === 'ImportedFile');

        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);

        const { additionalTextEdits, detail } = await completionProvider.resolveCompletion(
            document,
            item!
        );

        assert.strictEqual(detail, 'Auto import from ./imported-file.svelte\nclass ImportedFile');

        assert.strictEqual(
            harmonizeNewLines(additionalTextEdits![0]?.newText),
            // " instead of ' because VSCode uses " by default when there are no other imports indicating otherwise
            `${newLine}import ImportedFile from "./imported-file.svelte";${newLine}`
        );

        assert.deepEqual(
            additionalTextEdits![0]?.range,
            Range.create(Position.create(0, 8), Position.create(0, 8))
        );
    });

    it('resolve auto import completion (importing a svelte component, no script tag yet)', async () => {
        const { completionProvider, document, docManager } = setup('importcompletions5.svelte');
        // make sure that the ts language service does know about the imported-file file
        await openFileToBeImported(docManager, completionProvider);

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(0, 7)
        );
        document.version++;

        const item = completions?.items.find((item) => item.label === 'ImportedFile');

        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);

        const { additionalTextEdits, detail } = await completionProvider.resolveCompletion(
            document,
            item!
        );

        assert.strictEqual(detail, 'Auto import from ./imported-file.svelte\nclass ImportedFile');

        assert.strictEqual(
            harmonizeNewLines(additionalTextEdits![0]?.newText),
            // " instead of ' because VSCode uses " by default when there are no other imports indicating otherwise
            `<script>${newLine}import ImportedFile from "./imported-file.svelte";` +
                `${newLine}${newLine}</script>${newLine}`
        );

        assert.deepEqual(
            additionalTextEdits![0]?.range,
            Range.create(Position.create(0, 0), Position.create(0, 0))
        );
    });

    it('resolve auto completion without auto import (a svelte component which was already imported)', async () => {
        const { completionProvider, document, docManager } = setup('importcompletions6.svelte');
        // make sure that the ts language service does know about the imported-file file
        await openFileToBeImported(docManager, completionProvider);

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(3, 7)
        );
        document.version++;

        const item = completions?.items.find((item) => item.label === 'ImportedFile');

        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);

        const { additionalTextEdits } = await completionProvider.resolveCompletion(document, item!);

        assert.strictEqual(additionalTextEdits, undefined);
    });

    it('doesnt suggest svelte auto import when already other import with same name present', async () => {
        const { completionProvider, document, docManager } = setup(
            'importcompletions-2nd-import.svelte'
        );
        // make sure that the ts language service does know about the imported-file file
        await openFileToBeImported(docManager, completionProvider, 'ScndImport.svelte');

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(2, 13)
        );
        document.version++;

        const items = completions?.items.filter((item) => item.label === 'ScndImport');
        assert.equal(items?.length, 1);

        const item = items?.[0];
        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);
        assert.equal(item?.kind, CompletionItemKind.Variable);

        const { additionalTextEdits } = await completionProvider.resolveCompletion(document, item!);

        assert.strictEqual(additionalTextEdits, undefined);
    });
});

function harmonizeNewLines(input?: string) {
    return input?.replace(/\r\n/g, '~:~').replace(/\n/g, '~:~').replace(/~:~/g, ts.sys.newLine);
}
