import * as assert from 'assert';
import { SveltePlugin } from '../../src/plugins/SveltePlugin';
import { SvelteDocument } from '../../src/lib/documents/SvelteDocument';
import { Diagnostic, Range, DiagnosticSeverity } from '../../src/api';

describe('Svelte Plugin', () => {
    it('provides diagnostic warnings', () => {
        const plugin = new SveltePlugin();
        const document = new SvelteDocument(
            'file:///hello.html',
            '<h1>Hello, world!</h1>\n<img src="hello.png">',
        );
        const diagnostics = plugin.getDiagnostics(document);
        const diagnostic = Diagnostic.create(
            Range.create(1, 0, 1, 21),
            'A11y: <img> element should have an alt attribute',
            DiagnosticSeverity.Warning,
            undefined,
            'svelte',
        );

        assert.deepStrictEqual(diagnostics, [diagnostic]);
    });

    it('provides diagnostic errors', () => {
        const plugin = new SveltePlugin();
        const document = new SvelteDocument('file:///hello.html', '<div bind:whatever></div>');
        const diagnostics = plugin.getDiagnostics(document);
        const diagnostic = Diagnostic.create(
            Range.create(0, 5, 0, 18),
            "'whatever' is not a valid binding",
            DiagnosticSeverity.Error,
            undefined,
            'svelte',
        );

        assert.deepStrictEqual(diagnostics, [diagnostic]);
    });
});
