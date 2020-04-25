import * as assert from 'assert';
import { dirname, join } from 'path';
import { TypeScriptPlugin } from '../../../src/plugins';
import * as tsService from '../../../src/plugins/typescript/service';
import { DocumentManager, TextDocument } from '../../../src/lib/documents';
import { LSConfigManager } from '../../../src/ls-config';
import { Range, Position, Hover, CompletionItem, CompletionItemKind, FileChangeType } from 'vscode-languageserver';
import sinon from 'sinon';
import ts from 'typescript';
import { findTsConfigPath } from '../../../src/plugins/typescript/utils';
import { SnapshotManager } from '../../../src/plugins/typescript/SnapshotManager';
import { INITIAL_VERSION } from '../../../src/plugins/typescript/DocumentSnapshot';

describe('TypescriptPlugin', () => {
    afterEach(() => {
        sinon.restore();
    });

    function setup(content: string) {
        const plugin = new TypeScriptPlugin();
        const document = new TextDocument('file:///hello.svelte', content);
        const docManager = new DocumentManager(() => document);
        const pluginManager = new LSConfigManager();
        plugin.onRegister(docManager, pluginManager);
        docManager.openDocument(<any>'some doc');
        return { plugin, document };
    }

    it('provides diagnostics', () => {
        const { plugin, document } = setup(
            '<script lang="typescript">const asd: string = true</script>',
        );
        const diagnosticsStub = sinon.stub().returns([
            <ts.Diagnostic>{
                category: ts.DiagnosticCategory.Error,
                code: 2322,
                file: <any>null,
                length: 3,
                messageText: "Type 'true' is not assignable to type 'string'.",
                relatedInformation: undefined,
                start: 20,
            },
        ]);
        sinon.stub(tsService, 'getLanguageServiceForDocument').returns(<any>{
            getSyntacticDiagnostics: diagnosticsStub,
            getSuggestionDiagnostics: sinon.stub().returns([]),
            getSemanticDiagnostics: sinon.stub().returns([]),
        });

        const diagnostics = plugin.getDiagnostics(document);

        assert.deepStrictEqual(diagnostics, [
            {
                code: 2322,
                message: "Type 'true' is not assignable to type 'string'.",
                range: {
                    start: {
                        character: 46,
                        line: 0,
                    },
                    end: {
                        character: 49,
                        line: 0,
                    },
                },
                severity: 1,
                source: 'ts',
            },
        ]);
        sinon.assert.calledWith(diagnosticsStub, document.getFilePath()!);
    });

    it('provides hover info', async () => {
        const { plugin, document } = setup('<script>const a = true</script>');
        const hoverInfoStub = sinon.stub().returns(<ts.QuickInfo>{
            kind: ts.ScriptElementKind.constElement,
            textSpan: { start: 6, length: 1 },
            kindModifiers: '',
            displayParts: [
                { text: 'const', kind: 'keyword' },
                { text: ' ', kind: 'space' },
                { text: 'a', kind: 'localName' },
                { text: ':', kind: 'punctuation' },
                { text: ' ', kind: 'space' },
                { text: 'true', kind: 'keyword' },
            ],
        });
        sinon
            .stub(tsService, 'getLanguageServiceForDocument')
            .returns(<any>{ getQuickInfoAtPosition: hoverInfoStub });

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
        sinon.assert.calledWith(
            hoverInfoStub,
            document.getFilePath()!,
            document.offsetAt(Position.create(0, 6)),
        );
    });

    it('provides document symbols', () => {
        const { plugin, document } = setup('<script>function bla() {return true;} bla();</script>');

        // Typescript gets the snapshot in this instance, which is our snapshot function
        // which contains the document, so no need to mock typescript here.
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
                    uri: 'file:///hello.svelte',
                },
                name: 'bla',
            },
        ]);
    });

    it('provides completions', async () => {
        const { plugin, document } = setup(
            '<script>class A { b() { return true; } } new A().</script>',
        );

        const completionStub = sinon.stub().returns(<ts.WithMetadata<ts.CompletionInfo>>{
            name: 'b',
            kind: 'method',
            kindModifiers: '',
            isGlobalCompletion: false,
            isMemberCompletion: true,
            isNewIdentifierLocation: false,
            entries: [
                {
                    name: 'b',
                    kind: 'method',
                    kindModifiers: '',
                    sortText: '0',
                    isRecommended: undefined,
                },
            ],
        });
        sinon
            .stub(tsService, 'getLanguageServiceForDocument')
            .returns(<any>{ getCompletionsAtPosition: completionStub });

        const completions = plugin.getCompletions(document, Position.create(0, 48), '.');

        sinon.assert.calledWith(
            completionStub,
            document.getFilePath()!,
            document.offsetAt(Position.create(0, 40)),
        );
        assert.ok(
            Array.isArray(completions && completions.items),
            'Expected completion items to be an array',
        );
        assert.ok(completions!.items.length > 0, 'Expected completions to have length');
        assert.deepStrictEqual(completions!.items[0], <CompletionItem>{
            label: 'b',
            kind: CompletionItemKind.Method,
            sortText: '0',
            commitCharacters: ['.', ',', '('],
            preselect: undefined,
        });
    });

    it('provides definitions', () => {
        const { plugin, document } = setup(
            '<script lang="typescript">function bla() {return true;} bla();</script>',
        );

        // Typescript gets the snapshot in this instance, which is our snapshot function
        // which contains the document, so no need to mock typescript here.
        const definitions = plugin.getDefinitions(document, Position.create(0, 57));

        assert.deepStrictEqual(definitions, [
            {
                originSelectionRange: {
                    start: {
                        character: 56,
                        line: 0,
                    },
                    end: {
                        character: 59,
                        line: 0,
                    },
                },
                targetRange: {
                    start: {
                        character: 35,
                        line: 0,
                    },
                    end: {
                        character: 38,
                        line: 0,
                    },
                },
                targetSelectionRange: {
                    start: {
                        character: 35,
                        line: 0,
                    },
                    end: {
                        character: 38,
                        line: 0,
                    },
                },
                targetUri: 'file:///hello.svelte',
            },
        ]);
    });

    it('provides code actions', () => {
        const { plugin, document } = setup('<script>let a = true</script>');
        const codeFixStub = sinon.stub().returns([
            <ts.CodeFixAction>{
                changes: [
                    {
                        fileName: '/hello.svelte',
                        textChanges: [{ span: { start: 0, length: 12 }, newText: '' }],
                    },
                ],
                description: "Remove unused declaration for: 'a'",
                fixAllDescription: 'Delete all unused declarations',
                fixId: 'unusedIdentifier_delete',
                fixName: 'unusedIdentifier',
            },
        ]);
        sinon
            .stub(tsService, 'getLanguageServiceForDocument')
            .returns(<any>{ getCodeFixesAtPosition: codeFixStub });

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

        sinon.assert.calledWith(codeFixStub, document.getFilePath()!, 4, 5, [6133], {}, {});
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
                                uri: 'file:///hello.svelte',
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
        }
    }

    it('bumps snapshot version when watched file changes', () => {
        const { snapshotManager, mockProjectJsFile, plugin } = setupForOnWatchedFileChanges();

        const firstSnapshot = snapshotManager.get(mockProjectJsFile);
        const firstVersion = firstSnapshot?.version;

        assert.notEqual(firstVersion, INITIAL_VERSION);

        plugin.onWatchFileChanges(mockProjectJsFile, FileChangeType.Changed);
        const secondSnapshot = snapshotManager.get(mockProjectJsFile);

        assert.notEqual(secondSnapshot?.version, firstVersion);
    })

    it('should delete snapshot cache when file delete', () => {
        const { snapshotManager, mockProjectJsFile, plugin } = setupForOnWatchedFileChanges();

        const firstSnapshot = snapshotManager.get(mockProjectJsFile);
        assert.notEqual(firstSnapshot, undefined);

        plugin.onWatchFileChanges(mockProjectJsFile, FileChangeType.Deleted);
        const secondSnapshot = snapshotManager.get(mockProjectJsFile);

        assert.equal(secondSnapshot, undefined);
    })
});
