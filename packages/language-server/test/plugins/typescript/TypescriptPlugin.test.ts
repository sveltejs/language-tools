import * as assert from 'assert';
import * as path from 'path';
import { dirname, join } from 'path';
import { mkdirSync, rmdirSync } from 'fs';
import ts from 'typescript';
import {
    CompletionItem,
    CompletionItemKind,
    FileChangeType,
    Hover,
    Position,
    Range,
} from 'vscode-languageserver';
import { DocumentManager, TextDocument } from '../../../src/lib/documents';
import { LSConfigManager } from '../../../src/ls-config';
import { TypeScriptPlugin } from '../../../src/plugins';
import { INITIAL_VERSION } from '../../../src/plugins/typescript/DocumentSnapshot';
import { SnapshotManager } from '../../../src/plugins/typescript/SnapshotManager';
import { findTsConfigPath } from '../../../src/plugins/typescript/utils';
import { pathToUrl } from '../../../src/utils';

describe('TypescriptPlugin', () => {
    function getUri(filename: string) {
        const filePath = path.join(__dirname, 'testfiles', filename);
        return pathToUrl(filePath);
    }

    function setup(filename: string) {
        const plugin = new TypeScriptPlugin();
        const filePath = path.join(__dirname, 'testfiles', filename);
        const document = new TextDocument(pathToUrl(filePath), ts.sys.readFile(filePath)!);
        const docManager = new DocumentManager(() => document);
        const pluginManager = new LSConfigManager();
        plugin.onRegister(docManager, pluginManager);
        docManager.openDocument(<any>'some doc');
        return { plugin, document };
    }

    it('provides diagnostics', () => {
        const { plugin, document } = setup('diagnostics.svelte');
        const diagnostics = plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2322,
                message: "Type 'true' is not assignable to type 'string'.",
                range: {
                    start: {
                        character: 32,
                        line: 0,
                    },
                    end: {
                        character: 35,
                        line: 0,
                    },
                },
                severity: 1,
                source: 'ts',
            },
        ]);
    })
        // diagnostics might take longer, therefore increase the timeout
        .timeout(8000);

    it('provides hover info', async () => {
        const { plugin, document } = setup('hoverinfo.svelte');

        assert.deepStrictEqual(plugin.doHover(document, Position.create(0, 14)), <Hover>{
            contents: {
                language: 'ts',
                value: 'const a: true',
            },
            range: {
                start: {
                    character: 14,
                    line: 0,
                },
                end: {
                    character: 15,
                    line: 0,
                },
            },
        });
    });

    it('provides document symbols', () => {
        const { plugin, document } = setup('documentsymbols.svelte');
        const symbols = plugin.getDocumentSymbols(document);

        assert.deepStrictEqual(symbols, [
            {
                containerName: 'script',
                kind: 12,
                location: {
                    range: {
                        start: {
                            character: 8,
                            line: 0,
                        },
                        end: {
                            character: 37,
                            line: 0,
                        },
                    },
                    uri: getUri('documentsymbols.svelte'),
                },
                name: 'bla',
            },
        ]);
    });

    it('provides completions', async () => {
        const { plugin, document } = setup('completions.svelte');

        const completions = plugin.getCompletions(document, Position.create(0, 49), '.');

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
    });

    it('provides completion resolve info', async () => {
        const { plugin, document } = setup('completions.svelte');

        const completions = plugin.getCompletions(document, Position.create(0, 49), '.');

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
        const { plugin, document } = setup('documentation.svelte');

        const completions = plugin.getCompletions(document, Position.create(4, 8), '(');

        const { documentation, detail } = await plugin.resolveCompletion(
            document,
            completions?.items[0]!
        );

        assert.deepStrictEqual(detail, '(alias) function foo(): boolean\nimport foo');
        assert.deepStrictEqual(documentation, 'bars');
    });

    it('provides import completions for directory', async () => {
        const { plugin, document } = setup('importcompletions.svelte');
        const mockDirName = 'foo';
        const mockDirPath = path.join(__dirname, 'testfiles', mockDirName);

        mkdirSync(mockDirPath);

        try {
            const completions = plugin.getCompletions(document, Position.create(0, 27), '/');
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
        const { plugin, document } = setup('importcompletions.svelte');

        const completions = plugin.getCompletions(document, Position.create(0, 40));
        document.version++;

        const item = completions?.items.find(item => item.label === 'blubb');

        assert.equal(item?.additionalTextEdits, undefined);
        assert.equal(item?.detail, undefined);

        const { additionalTextEdits, detail } = await plugin.resolveCompletion(document, item!);

        assert.strictEqual(detail, 'Auto import from ./definitions\nfunction blubb(): boolean');

        assert.strictEqual(
            additionalTextEdits![0]?.newText.replace('\r', '').replace('\n', ''),
            `import { blubb } from './definitions'`,
        );
    });

    it('provides definitions within svelte doc', () => {
        const { plugin, document } = setup('definitions.svelte');

        const definitions = plugin.getDefinitions(document, Position.create(0, 94)); // +7

        assert.deepStrictEqual(definitions, [
            {
                originSelectionRange: {
                    start: {
                        character: 93,
                        line: 0,
                    },
                    end: {
                        character: 96,
                        line: 0,
                    },
                },
                targetRange: {
                    start: {
                        character: 72,
                        line: 0,
                    },
                    end: {
                        character: 75,
                        line: 0,
                    },
                },
                targetSelectionRange: {
                    start: {
                        character: 72,
                        line: 0,
                    },
                    end: {
                        character: 75,
                        line: 0,
                    },
                },
                targetUri: getUri('definitions.svelte'),
            },
        ]);
    });

    it('provides definitions from svelte to ts doc', () => {
        const { plugin, document } = setup('definitions.svelte');

        const definitions = plugin.getDefinitions(document, Position.create(0, 101));

        assert.deepStrictEqual(definitions, [
            {
                originSelectionRange: {
                    start: {
                        character: 100,
                        line: 0,
                    },
                    end: {
                        character: 105,
                        line: 0,
                    },
                },
                targetRange: {
                    start: {
                        character: 16,
                        line: 0,
                    },
                    end: {
                        character: 21,
                        line: 0,
                    },
                },
                targetSelectionRange: {
                    start: {
                        character: 16,
                        line: 0,
                    },
                    end: {
                        character: 21,
                        line: 0,
                    },
                },
                targetUri: getUri('definitions.ts'),
            },
        ]);
    });

    it('provides code actions', () => {
        const { plugin, document } = setup('codeactions.svelte');

        const codeActions = plugin.getCodeActions(
            document,
            Range.create(Position.create(0, 12), Position.create(0, 13)),
            {
                diagnostics: [
                    {
                        code: 6133,
                        message: "'a' is declared but its value is never read.",
                        range: Range.create(Position.create(0, 12), Position.create(0, 13)),
                        source: 'ts',
                    },
                ],
                only: ['quickfix'],
            },
        );

        assert.deepStrictEqual(codeActions, [
            {
                edit: {
                    documentChanges: [
                        {
                            edits: [
                                {
                                    newText: '',
                                    range: {
                                        start: {
                                            character: 8,
                                            line: 0,
                                        },
                                        end: {
                                            character: 20,
                                            line: 0,
                                        },
                                    },
                                },
                            ],
                            textDocument: {
                                uri: getUri('codeactions.svelte'),
                                version: null,
                            },
                        },
                    ],
                },
                kind: 'unusedIdentifier',
                title: "Remove unused declaration for: 'a'",
            },
        ]);
    });

    const setupForOnWatchedFileChanges = () => {
        const { plugin, document } = setup('');
        const filePath = document.getFilePath()!;
        const tsConfigPath = findTsConfigPath(filePath);
        const snapshotManager = SnapshotManager.getFromTsConfigPath(tsConfigPath);
        const mockProjectJsFile = join(dirname(filePath), 'whatever.js');

        plugin.onWatchFileChanges(mockProjectJsFile, FileChangeType.Changed);

        return {
            snapshotManager,
            plugin,
            mockProjectJsFile,
        };
    };

    it('bumps snapshot version when watched file changes', () => {
        const { snapshotManager, mockProjectJsFile, plugin } = setupForOnWatchedFileChanges();

        const firstSnapshot = snapshotManager.get(mockProjectJsFile);
        const firstVersion = firstSnapshot?.version;

        assert.notEqual(firstVersion, INITIAL_VERSION);

        plugin.onWatchFileChanges(mockProjectJsFile, FileChangeType.Changed);
        const secondSnapshot = snapshotManager.get(mockProjectJsFile);

        assert.notEqual(secondSnapshot?.version, firstVersion);
    });

    it('should delete snapshot cache when file delete', () => {
        const { snapshotManager, mockProjectJsFile, plugin } = setupForOnWatchedFileChanges();

        const firstSnapshot = snapshotManager.get(mockProjectJsFile);
        assert.notEqual(firstSnapshot, undefined);

        plugin.onWatchFileChanges(mockProjectJsFile, FileChangeType.Deleted);
        const secondSnapshot = snapshotManager.get(mockProjectJsFile);

        assert.equal(secondSnapshot, undefined);
    });
});
