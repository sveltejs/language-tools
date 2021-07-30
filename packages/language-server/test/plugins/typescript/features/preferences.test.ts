import ts from 'typescript';
import assert from 'assert';
import { join } from 'path';

import {
    CodeActionContext,
    Diagnostic,
    DiagnosticSeverity,
    Position,
    Range,
    TextDocumentEdit
} from 'vscode-languageserver';
import { Document, DocumentManager } from '../../../../src/lib/documents';
import { CompletionsProviderImpl } from '../../../../src/plugins/typescript/features/CompletionProvider';
import { LSAndTSDocResolver } from '../../../../src/plugins/typescript/LSAndTSDocResolver';
import { pathToUrl } from '../../../../src/utils';
import { CodeActionsProviderImpl } from '../../../../src/plugins/typescript/features/CodeActionsProvider';
import { LSConfigManager, TSUserConfig } from '../../../../src/ls-config';

const testFilesDir = join(__dirname, '..', 'testfiles', 'preferences');

describe('ts user preferences', () => {
    function setup(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );

        const filePath = join(testFilesDir, filename);
        const document = docManager.openDocument(<any>{
            uri: pathToUrl(filePath),
            text: ts.sys.readFile(filePath) || ''
        });
        return { document, docManager };
    }

    const expectedImportEdit = "import { definition } from '~/definition/index';";

    function getPreferences(): TSUserConfig {
        return {
            preferences: {
                importModuleSpecifier: 'non-relative',
                importModuleSpecifierEnding: 'index',
                quoteStyle: 'single'
            },
            suggest: {
                autoImports: true,
                includeAutomaticOptionalChainCompletions: undefined,
                includeCompletionsForImportStatements: undefined
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
        return new LSAndTSDocResolver(docManager, [pathToUrl(testFilesDir)], configManager);
    }

    it('provides auto import completion according to preferences', async () => {
        const { docManager, document } = setup('code-action.svelte');
        const lsAndTsDocResolver = createLSAndTSDocResolver(docManager);
        const completionProvider = new CompletionsProviderImpl(lsAndTsDocResolver);

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
        const lsAndTsDocResolver = createLSAndTSDocResolver(docManager);
        const completionProvider = new CompletionsProviderImpl(lsAndTsDocResolver);
        const codeActionProvider = new CodeActionsProviderImpl(
            lsAndTsDocResolver,
            completionProvider
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
        const lsAndTsDocResolver = createLSAndTSDocResolver(docManager, {
            suggest: {
                autoImports: false,
                includeAutomaticOptionalChainCompletions: undefined,
                includeCompletionsForImportStatements: undefined
            }
        });
        const completionProvider = new CompletionsProviderImpl(lsAndTsDocResolver);

        const completions = await completionProvider.getCompletions(
            document,
            Position.create(1, 14)
        );

        const item = completions?.items.find((item) => item.label === 'definition');
        assert.strictEqual(item, undefined, 'Expected no auto import suggestions');
    });
});
