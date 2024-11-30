import assert from 'assert';
import { join } from 'path';
import ts from 'typescript';
import {
    CodeActionContext,
    Diagnostic,
    DiagnosticSeverity,
    Position,
    Range,
    TextDocumentEdit
} from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { LSConfigManager, TSUserConfig, TsUserPreferencesConfig } from '../../../../src/ls-config';
import { CodeActionsProviderImpl } from '../../../../src/plugins/typescript/features/CodeActionsProvider';
import { CompletionsProviderImpl } from '../../../../src/plugins/typescript/features/CompletionProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl } from '../../../../src/utils';
import { serviceWarmup } from '../test-utils';

const testFilesDir = join(__dirname, '..', 'testfiles', 'preferences');

describe('ts user preferences', function () {
    serviceWarmup(this, testFilesDir);

    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );

        const filePath = join(testFilesDir, filename);
        const document = docManager.openClientDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath) || ''
        });
        return { document, docManager };
    }

    const expectedImportEdit = "import { definition } from '~/definition/index';";

    function getPreferences(): TSUserConfig {
        return {
            preferences: {
                ...getDefaultPreferences(),
                importModuleSpecifier: 'non-relative',
                importModuleSpecifierEnding: 'index'
            },
            suggest: {
                autoImports: true,
                includeAutomaticOptionalChainCompletions: undefined,
                includeCompletionsForImportStatements: undefined,
                classMemberSnippets: undefined,
                objectLiteralMethodSnippets: undefined,
                includeCompletionsWithSnippetText: undefined
            }
        };
    }

    function createLSAndTSDocResolver(
        docManager: DocumentManager,
        preferences?: Partial<TSUserConfig>
    ) {
        const configManager = new LSConfigManager();
        configManager.updateTsJsUserPreferences({
            typescript: { ...getPreferences(), ...preferences },
            javascript: { ...getPreferences(), ...preferences }
        });
        return {
            lsAndTsDocResolver: new LSAndTSDocResolver(
                docManager,
                [pathToUrl(testFilesDir)],
                configManager
            ),
            configManager
        };
    }

    function getDefaultPreferences(): TsUserPreferencesConfig {
        return {
            autoImportFileExcludePatterns: undefined,
            importModuleSpecifier: 'non-relative',
            importModuleSpecifierEnding: undefined,
            quoteStyle: 'single',
            includePackageJsonAutoImports: undefined,
            organizeImports: undefined
        };
    }

    it('provides auto import completion according to preferences', async () => {
        const { docManager, document } = setup('code-action.svelte');
        const { lsAndTsDocResolver, configManager } = createLSAndTSDocResolver(docManager);
        const completionProvider = new CompletionsProviderImpl(lsAndTsDocResolver, configManager);

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(1, 14)
        );

        const item = completions?.items.find((item) => item.label === 'definition');

        const { additionalTextEdits } = await completionProvider.resolveCompletion(document, item!);
        assert.strictEqual(additionalTextEdits![0].newText.trim(), expectedImportEdit);
    });

    async function importCodeActionTest(
        filename: string,
        range: Range,
        context: CodeActionContext
    ) {
        const { docManager, document } = setup(filename);
        const { lsAndTsDocResolver, configManager } = createLSAndTSDocResolver(docManager);
        const completionProvider = new CompletionsProviderImpl(lsAndTsDocResolver, configManager);

        const codeActionProvider = new CodeActionsProviderImpl(
            lsAndTsDocResolver,
            completionProvider,
            configManager
        );

        const codeAction = await codeActionProvider.getCodeActions(document, range, context);
        const documentChange = codeAction[0].edit?.documentChanges?.[0] as
            | TextDocumentEdit
            | undefined;
        assert.strictEqual(documentChange?.edits[0].newText.trim(), expectedImportEdit);
    }

    it('provides auto import code action according to preferences', async () => {
        const range = Range.create(Position.create(1, 4), Position.create(1, 14));
        await importCodeActionTest('code-action.svelte', range, {
            diagnostics: [
                Diagnostic.create(
                    range,
                    "Cannot find name 'definition'",
                    DiagnosticSeverity.Error,
                    2304,
                    'ts'
                )
            ]
        });
    });

    it('provides auto import suggestions according to preferences', async () => {
        const { docManager, document } = setup('code-action.svelte');
        const { lsAndTsDocResolver, configManager } = createLSAndTSDocResolver(docManager, {
            suggest: {
                autoImports: false,
                includeAutomaticOptionalChainCompletions: undefined,
                includeCompletionsForImportStatements: undefined,
                classMemberSnippets: undefined,
                objectLiteralMethodSnippets: undefined,
                includeCompletionsWithSnippetText: undefined
            }
        });
        const completionProvider = new CompletionsProviderImpl(lsAndTsDocResolver, configManager);

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(1, 14)
        );

        const item = completions?.items.find((item) => item.label === 'definition');
        assert.strictEqual(item, undefined, 'Expected no auto import suggestions');
    });

    const expectedComponentImportEdit = "import Imports from '~/imports.svelte';";

    function setupImportModuleSpecifierEndingJs() {
        const { docManager, document } = setup('module-specifier-js.svelte');
        const { lsAndTsDocResolver, configManager } = createLSAndTSDocResolver(docManager, {
            preferences: {
                ...getDefaultPreferences(),
                importModuleSpecifierEnding: 'js'
            }
        });

        return { document, lsAndTsDocResolver, configManager };
    }

    it('provides auto import for svelte component when importModuleSpecifierEnding is js', async () => {
        const { document, lsAndTsDocResolver } = setupImportModuleSpecifierEndingJs();

        const completionProvider = new CompletionsProviderImpl(
            lsAndTsDocResolver,
            new LSConfigManager()
        );

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(4, 8)
        );

        const item = completions?.items.find((item) => item.label === 'Imports');
        const { additionalTextEdits } = await completionProvider.resolveCompletion(document, item!);
        assert.strictEqual(additionalTextEdits![0].newText.trim(), expectedComponentImportEdit);
    });

    it('provides auto import for context="module" export when importModuleSpecifierEnding is js', async () => {
        const { document, lsAndTsDocResolver } = setupImportModuleSpecifierEndingJs();

        const completionProvider = new CompletionsProviderImpl(
            lsAndTsDocResolver,
            new LSConfigManager()
        );

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(1, 6)
        );

        const item = completions?.items.find((item) => item.label === 'hi');
        const { additionalTextEdits } = await completionProvider.resolveCompletion(document, item!);
        assert.strictEqual(
            additionalTextEdits![0].newText.trim(),
            "import { hi } from '~/with-context-module.svelte';"
        );
    });

    it('provides import code action for svelte component when importModuleSpecifierEnding is js', async () => {
        const range = Range.create(Position.create(4, 1), Position.create(4, 8));
        const { document, lsAndTsDocResolver } = setupImportModuleSpecifierEndingJs();

        const completionProvider = new CompletionsProviderImpl(
            lsAndTsDocResolver,
            new LSConfigManager()
        );
        const codeActionProvider = new CodeActionsProviderImpl(
            lsAndTsDocResolver,
            completionProvider,
            new LSConfigManager()
        );

        const codeAction = await codeActionProvider.getCodeActions(document, range, {
            diagnostics: [
                Diagnostic.create(
                    range,
                    "Cannot find name 'Imports'",
                    DiagnosticSeverity.Error,
                    2304,
                    'ts'
                )
            ]
        });

        const documentChange = codeAction[0].edit?.documentChanges?.[0] as
            | TextDocumentEdit
            | undefined;
        assert.strictEqual(documentChange?.edits[0].newText.trim(), expectedComponentImportEdit);
    });

    async function testExcludeDefinitionDir(pattern: string) {
        const { docManager, document } = setup('code-action.svelte');
        const { lsAndTsDocResolver, configManager } = createLSAndTSDocResolver(docManager, {
            preferences: {
                ...getDefaultPreferences(),
                autoImportFileExcludePatterns: [pattern]
            }
        });
        const completionProvider = new CompletionsProviderImpl(lsAndTsDocResolver, configManager);

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(1, 14)
        );

        const item = completions?.items.find((item) => item.label === 'definition');

        assert.equal(item, undefined);
    }

    it('exclude auto import', async () => {
        await testExcludeDefinitionDir('definition');
    });

    it('exclude auto import (relative pattern)', async () => {
        await testExcludeDefinitionDir('./definition');
    });

    it('exclude auto import (**/ pattern)', async () => {
        await testExcludeDefinitionDir('**/definition');
    });

    it('exclude auto import outside of the root', async () => {
        const { docManager, document } = setup('code-action-outside-root.svelte');
        const { lsAndTsDocResolver, configManager } = createLSAndTSDocResolver(docManager, {
            preferences: {
                ...getDefaultPreferences(),
                autoImportFileExcludePatterns: ['definitions.ts']
            }
        });
        const completionProvider = new CompletionsProviderImpl(lsAndTsDocResolver, configManager);

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(4, 7)
        );

        const item = completions?.items.find((item) => item.label === 'blubb');

        assert.equal(item, undefined);
    });
});
