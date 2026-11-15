import { describe, expect, it } from 'vitest';
import type { CompletionItem } from '@typescript/native/vscode' with { 'resolution-mode': 'import' };
import { fixImportEdits } from '../src/typescript-go/middleware/importEdits';

function view(text: string) {
    const lineStarts = [0, ...[...text.matchAll(/\n/g)].map((m) => m.index! + 1)];
    return {
        getText: () => text,
        offsetAt: (p: { line: number; character: number }) => lineStarts[p.line] + p.character,
        positionAt: (o: number) => {
            const line = lineStarts.filter((start) => start <= o).length - 1;
            return { line, character: o - lineStarts[line] };
        }
    };
}

/** Applies the item's additional edits (non-overlapping) */
function apply(text: string, item: CompletionItem) {
    const doc = view(text);
    const edits = [...(item.additionalTextEdits ?? [])].sort(
        (a, b) => doc.offsetAt(b.range.start) - doc.offsetAt(a.range.start)
    );
    for (const edit of edits) {
        text =
            text.slice(0, doc.offsetAt(edit.range.start)) +
            edit.newText +
            text.slice(doc.offsetAt(edit.range.end));
    }
    return text;
}

const options = { newScriptTag: '<script lang="ts">' };
const importAt = (line: number, character: number, newText: string): CompletionItem => ({
    label: 'Child',
    additionalTextEdits: [
        { range: { start: { line, character }, end: { line, character } }, newText }
    ]
});

describe('fixImportEdits', () => {
    it('creates a script tag if there is none (TS7 inserts after the first `<`)', () => {
        const text = '<Child ';
        const item = fixImportEdits(
            importAt(0, 1, '\nimport Child from "./Child.svelte";\n\n'),
            view(text),
            options
        );
        expect(apply(text, item)).toBe(
            '<script lang="ts">\n\timport Child from "./Child.svelte";\n</script>\n\n<Child '
        );
    });

    it('moves imports into an empty script (TS7 inserts after `</script>`)', () => {
        const text = '<script></script>\n\n<div><Di</div>';
        const item = fixImportEdits(
            importAt(0, 17, '\nimport Diag from "./Diag.svelte";\n'),
            view(text),
            options
        );
        expect(apply(text, item)).toBe(
            '<script>\n\timport Diag from "./Diag.svelte";\n</script>\n\n<div><Di</div>'
        );
    });

    it('moves imports into the start of a non-empty script, using its indentation', () => {
        const text = '<script>\n    let a = 1;\n</script>\n<Di';
        const item = fixImportEdits(
            importAt(3, 0, 'import Diag from "./Diag.svelte";\n'),
            view(text),
            options
        );
        expect(apply(text, item)).toBe(
            '<script>\n    import Diag from "./Diag.svelte";\n    let a = 1;\n</script>\n<Di'
        );
    });

    it('prefers the instance script over the module script', () => {
        const text = '<script module>\n\texport const x = 1;\n</script>\n<script></script>\n<Di';
        const item = fixImportEdits(
            importAt(4, 0, 'import Diag from "./Diag.svelte";\n'),
            view(text),
            options
        );
        expect(apply(text, item)).toContain(
            '<script>\n\timport Diag from "./Diag.svelte";\n</script>'
        );
    });

    it('keeps edits inside a script and non-import edits', () => {
        const text = '<script>\n\tlet a = 1;\n</script>\n<Di';
        const inside = importAt(0, 8, '\n\timport Diag from "./Diag.svelte";');
        expect(fixImportEdits(inside, view(text), options)).toBe(inside);
        const other = importAt(3, 0, 'x');
        expect(fixImportEdits(other, view(text), options)).toBe(other);
    });
});
