import { describe, expect, it } from 'vitest';
import type { CodeAction } from '@typescript/native/vscode' with { 'resolution-mode': 'import' };
import { transformCodeActions } from '../src/typescript-go/middleware/codeActions';
import { isInStartTag } from '../src/typescript-go/middleware/componentTagText';

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

function apply(text: string, edits: { range: any; newText: string }[]) {
    const doc = view(text);
    for (const edit of [...edits].sort(
        (a, b) => doc.offsetAt(b.range.start) - doc.offsetAt(a.range.start)
    )) {
        text =
            text.slice(0, doc.offsetAt(edit.range.start)) +
            edit.newText +
            text.slice(doc.offsetAt(edit.range.end));
    }
    return text;
}

const options = { newScriptTag: '<script lang="ts">' };
const uri = 'file:///src/Fix.svelte';

describe('tsgo: code actions', () => {
    // measured from TS7 7.1.0-dev.20261125.1 for `{onMount}` in the template
    const text = '<script lang="ts">\n\tlet n: number = 1;\n</script>\n\n<p>{onMount}{n}</p>\n';
    const addImport = (newText: string): CodeAction => ({
        title: 'Add import from "svelte"',
        kind: 'quickfix',
        edit: {
            changes: {
                [uri]: [
                    {
                        range: {
                            start: { line: 0, character: 18 },
                            end: { line: 0, character: 18 }
                        },
                        newText
                    }
                ]
            }
        }
    });

    it('indents an import quick fix like the script', () => {
        const [action] = transformCodeActions(
            [addImport('\n    import { onMount } from "svelte";\n')],
            uri,
            view(text),
            options
        ) as CodeAction[];
        expect(apply(text, action.edit!.changes![uri])).toBe(
            '<script lang="ts">\n\timport { onMount } from "svelte";\n\n\tlet n: number = 1;\n</script>\n\n<p>{onMount}{n}</p>\n'
        );
    });

    it('keeps an unindented script unindented', () => {
        const unindented = '<script lang="ts">\nlet n = 1;\n</script>\n{onMount}';
        const [action] = transformCodeActions(
            [addImport('\n    import { onMount } from "svelte";\n')],
            uri,
            view(unindented),
            options
        ) as CodeAction[];
        expect(apply(unindented, action.edit!.changes![uri])).toContain(
            '\nimport { onMount } from "svelte";\n'
        );
    });

    it('names component imports after the component', () => {
        const [action] = transformCodeActions(
            [
                {
                    ...addImport('\n\timport Child__SvelteComponent_ from "./Child.svelte";\n'),
                    title: 'Add import from "./Child.svelte" (Child__SvelteComponent_)'
                }
            ],
            uri,
            view(text),
            options
        ) as CodeAction[];
        expect(action.title).toBe('Add import from "./Child.svelte" (Child)');
        expect(action.edit!.changes![uri][0].newText).toBe(
            '\n\timport Child from "./Child.svelte";\n'
        );
    });

    describe('real TS7 quick fixes (7.1.0-dev.20261125.1, recorded with e2e/scripts/lsp-dump.mjs)', () => {
        const recorded = (line: number, character: number, newText: string): CodeAction => ({
            title: 'Add import from "svelte"',
            kind: 'quickfix',
            edit: {
                changes: {
                    [uri]: [
                        {
                            range: { start: { line, character }, end: { line, character } },
                            newText
                        }
                    ]
                }
            }
        });
        const applyAction = (doc: string, action: CodeAction) => {
            const [result] = transformCodeActions(
                [action],
                uri,
                view(doc),
                options
            ) as CodeAction[];
            return apply(doc, result.edit!.changes![uri]);
        };

        it('no script: TS7 inserts after the first `<`; a script is created instead', () => {
            const doc = '<p>{onMount}</p>\n';
            // as TS7 returns it: `<` + import + `p>…`
            const action = recorded(0, 1, '\nimport { onMount } from "svelte";\n\n');
            expect(applyAction(doc, action)).toBe(
                '<script lang="ts">\n\timport { onMount } from "svelte";\n</script>\n\n<p>{onMount}</p>\n'
            );
        });

        it('only a module script: the import stays in it, indented like it', () => {
            const doc =
                '<script lang="ts" module>\n\texport const x = 1;\n</script>\n\n{onMount}\n';
            const action = recorded(0, 25, '\nimport { onMount } from "svelte";\n');
            expect(applyAction(doc, action)).toBe(
                '<script lang="ts" module>\n\timport { onMount } from "svelte";\n\n\texport const x = 1;\n</script>\n\n{onMount}\n'
            );
        });
    });

    it('moves an import outside of the script into it', () => {
        const misplaced: CodeAction = {
            title: 'Add import',
            edit: {
                changes: {
                    [uri]: [
                        {
                            range: {
                                start: { line: 4, character: 0 },
                                end: { line: 4, character: 0 }
                            },
                            newText: 'import { onMount } from "svelte";\n'
                        }
                    ]
                }
            }
        };
        const [action] = transformCodeActions(
            [misplaced],
            uri,
            view(text),
            options
        ) as CodeAction[];
        const result = apply(text, action.edit!.changes![uri]);
        expect(result.split('</script>')[0]).toContain('\timport { onMount } from "svelte";');
        expect(result.split('</script>')[1]).not.toContain('import');
    });

    it('leaves commands and null alone', () => {
        const command = { title: 'x', command: 'y' };
        expect(transformCodeActions([command], uri, view(text), options)).toEqual([command]);
        expect(transformCodeActions(null, uri, view(text), options)).toBe(null);
    });
});

describe('tsgo: isInStartTag', () => {
    const at = (textWithCursor: string) => {
        const offset = textWithCursor.indexOf('|');
        return isInStartTag(textWithCursor.replace('|', ''), offset);
    };

    it.each([
        ['<input on|', true],
        ['<div |>', true],
        ['<div class="a" aria|', true],
        ['<Child v|', true],
        ['<div onclick={() => v|}', true],
        ['<div title="a > b" x|', true],
        ['<|', false],
        ['<di|', false],
        ['<div>te|xt', false],
        ['<div onclick={() => 1}>{a|}', false],
        ['{a <b|}', false],
        ['<script>\nconst a = <T|', false],
        ['<!-- <div x| -->', false],
        ['plain te|xt', false]
    ])('%s => %s', (text, expected) => {
        expect(at(text)).toBe(expected);
    });
});
