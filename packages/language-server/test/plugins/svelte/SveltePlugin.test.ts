import * as assert from 'assert';
import { SveltePlugin } from '../../../src/plugins';
import { DocumentManager, Document } from '../../../src/lib/documents';
import { Diagnostic, Range, DiagnosticSeverity } from 'vscode-languageserver';
import { LSConfigManager } from '../../../src/ls-config';

describe('Svelte Plugin', () => {
    function setup(content: string) {
        const document = new Document('file:///hello.svelte', content);
        const docManager = new DocumentManager(() => document);
        const pluginManager = new LSConfigManager();
        const plugin = new SveltePlugin(pluginManager);
        docManager.openDocument(<any>'some doc');
        return { plugin, document };
    }

    it('provides diagnostic warnings', async () => {
        const { plugin, document } = setup('<h1>Hello, world!</h1>\n<img src="hello.png">');

        const diagnostics = await plugin.getDiagnostics(document);
        const diagnostic = Diagnostic.create(
            Range.create(1, 0, 1, 21),
            'A11y: <img> element should have an alt attribute',
            DiagnosticSeverity.Warning,
            'a11y-missing-attribute',
            'svelte',
        );

        assert.deepStrictEqual(diagnostics, [diagnostic]);
    });

    it('provides diagnostic errors', async () => {
        const { plugin, document } = setup('<div bind:whatever></div>');

        const diagnostics = await plugin.getDiagnostics(document);
        const diagnostic = Diagnostic.create(
            Range.create(0, 10, 0, 18),
            'whatever is not declared',
            DiagnosticSeverity.Error,
            'binding-undeclared',
            'svelte',
        );

        assert.deepStrictEqual(diagnostics, [diagnostic]);
    });
});
