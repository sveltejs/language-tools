import { describe, expect, it } from 'vitest';
import type { CompletionList } from '@typescript/native/vscode' with { 'resolution-mode': 'import' };
import {
    CompletionMiddlewareHost,
    CompletionResult,
    filterGeneratedCompletions,
    renameComponentAutoImport,
    transformCompletions
} from '../src/typescript-go/middleware/completions';

describe('filterGeneratedCompletions', () => {
    // labels as returned by TS7 + content mapper for a `{v|}` template expression
    const labels = [
        'value',
        'x',
        '$$render',
        'Complete__SvelteComponent_',
        '__sveltets_2_any',
        '__sveltets_$$bindings',
        '$$_abc',
        '$$ComponentProps',
        'svelteHTML',
        'svelteNative',
        'SvelteStore',
        '$$props',
        '$state',
        'parseInt'
    ];
    const kept = ['value', 'x', '$$props', '$state', 'parseInt'];

    it('filters completion lists', () => {
        const result = filterGeneratedCompletions({
            isIncomplete: false,
            items: labels.map((label) => ({ label }))
        });
        expect(result?.items.map((i) => i.label)).toEqual(kept);
        expect(result?.isIncomplete).toBe(false);
    });

    it('filters completion arrays', () => {
        const result = filterGeneratedCompletions(labels.map((label) => ({ label })));
        expect(result?.map((i) => i.label)).toEqual(kept);
    });

    it('handles null', () => {
        expect(filterGeneratedCompletions(null)).toBe(null);
    });
});

describe('transformCompletions at a component tag name', () => {
    const script = '<script lang="ts">\n\timport Child from "./Child.svelte";\n</script>\n';

    function setup(textWithCursor: string, scriptResult: CompletionResult | undefined) {
        const offset = textWithCursor.indexOf('|');
        const text = textWithCursor.slice(0, offset) + textWithCursor.slice(offset + 1);
        const lineStarts = [0, ...[...text.matchAll(/\n/g)].map((m) => m.index! + 1)];
        const offsetAt = (p: { line: number; character: number }) =>
            lineStarts[p.line] + p.character;
        const positionAt = (o: number) => {
            const line = lineStarts.filter((start) => start <= o).length - 1;
            return { line, character: o - lineStarts[line] };
        };
        const requests: { line: number; character: number }[] = [];
        let responses: (CompletionResult | undefined)[] | undefined;
        const host: CompletionMiddlewareHost = {
            cache: {},
            importEditOptions: { newScriptTag: '<script>' },
            getDocument: () => ({ getText: () => text, offsetAt, positionAt }),
            requestCompletions: async (_uri, position) => {
                requests.push(position);
                return responses ? responses.shift() : scriptResult;
            }
        };
        const params = { textDocument: { uri: 'file:///A.svelte' }, position: positionAt(offset) };
        return {
            host,
            params,
            requests,
            text,
            offsetAt,
            respondWith: (...r: (CompletionResult | undefined)[]) => (responses = r)
        };
    }

    const importEdit = (name: string) => ({
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } },
        newText: `\timport ${name} from "./Button.svelte";\n`
    });
    // what TS7 returns at the end of the instance script (sortText: 11 locals, 15 globals, 16 auto-imports)
    const scriptCompletions: CompletionList = {
        isIncomplete: false,
        items: [
            { label: 'Child', kind: 6, sortText: '11', data: { position: 1 } },
            { label: 'count', kind: 6, sortText: '11' },
            { label: 'Array', kind: 6, sortText: '15' },
            { label: 'External', kind: 6, sortText: 'z15' },
            { label: 'console', kind: 6, sortText: '15' },
            {
                label: 'Button__SvelteComponent_',
                kind: 6,
                sortText: '16',
                data: { autoImport: { moduleSpecifier: './Button.svelte' } },
                additionalTextEdits: [importEdit('Button__SvelteComponent_')]
            },
            {
                label: 'ModuleKind',
                kind: 13,
                sortText: '16',
                data: { autoImport: { moduleSpecifier: 'typescript' } }
            },
            { label: 'Props', kind: 8, sortText: '11' },
            { label: 'Child__SvelteComponent_', kind: 6, sortText: '11' },
            {
                label: 'Other',
                kind: 6,
                sortText: '11',
                textEdit: {
                    range: { start: { line: 1, character: 0 }, end: { line: 1, character: 0 } },
                    newText: 'Other'
                }
            }
        ]
    };

    it('asks TS7 at the end of the script after `<` and returns components as incomplete list', async () => {
        const { host, params, requests, text, offsetAt } = setup(
            script + '<div>\n\t<|\n</div>',
            scriptCompletions
        );
        const result = (await transformCompletions(null, params, host)) as CompletionList;
        expect(result.isIncomplete).toBe(true);
        expect(result.items.map((i) => i.label)).toEqual(['Child', 'Button', 'Other']);
        // TS7's data is kept for completionItem/resolve, text edits for the other position are not
        expect(result.items[0].data).toEqual({ position: 1 });
        expect(result.items[2].textEdit).toBe(undefined);
        expect(result.items[2].insertText).toBe('Other');
        expect(requests).toHaveLength(1);
        expect(text.slice(0, offsetAt(requests[0]))).toBe('<script lang="ts">');
    });

    it('reuses the script completions while typing in the template', async () => {
        const first = setup(script + '<div>\n\t<|\n</div>', scriptCompletions);
        await transformCompletions(null, first.params, first.host);
        const second = setup(script + '<div>\n\t<C|\n</div>', undefined);
        second.host.cache = first.host.cache;
        const atTag: CompletionList = {
            isIncomplete: false,
            items: [{ label: 'Child', kind: 6, sortText: '11' }]
        };
        const result = (await transformCompletions(
            atTag,
            second.params,
            second.host
        )) as CompletionList;
        expect(result.items.map((i) => i.label)).toEqual(['Child', 'Button']);
        expect(second.requests).toHaveLength(0);

        // changed script -> ask again
        const third = setup(script.replace('Child', 'Kid') + '<C|', scriptCompletions);
        third.host.cache = first.host.cache;
        await transformCompletions(atTag, third.params, third.host);
        expect(third.requests).toHaveLength(1);
    });

    it('prefers locals over auto-imports of the same name', async () => {
        const { host, params } = setup(script + '<|', {
            isIncomplete: false,
            items: [
                { label: 'Child', kind: 6, sortText: '11' },
                {
                    label: 'Child__SvelteComponent_',
                    kind: 6,
                    sortText: '16',
                    data: { autoImport: { moduleSpecifier: './Child.svelte' } }
                }
            ]
        });
        const result = (await transformCompletions(null, params, host)) as CompletionList;
        expect(result.items).toEqual([{ label: 'Child', kind: 6, sortText: '11' }]);
    });

    it('renames component auto-imports', async () => {
        const { host, params } = setup(script + '<|', scriptCompletions);
        const result = (await transformCompletions(null, params, host)) as CompletionList;
        const button = result.items.find((i) => i.label === 'Button')!;
        expect(button.insertText).toBe('Button');
        expect(button.additionalTextEdits).toEqual([importEdit('Button')]);
    });

    it('at `<C`, keeps TS7 components and adds auto-imports from the script', async () => {
        const { host, params, requests } = setup(
            script + '<div>\n\t<C|\n</div>',
            scriptCompletions
        );
        const atTag: CompletionList = {
            isIncomplete: false,
            items: [
                { label: 'Child', kind: 6, sortText: '11', data: { position: 2 } },
                { label: 'CSS', kind: 6, sortText: '15' },
                { label: 'count', kind: 6, sortText: '11' }
            ]
        };
        const result = (await transformCompletions(atTag, params, host)) as CompletionList;
        expect(result.items.map((i) => i.label)).toEqual(['Child', 'Button']);
        // TS7's own item for the real position wins
        expect(result.items[0].data).toEqual({ position: 2 });
        expect(result.isIncomplete).toBe(false);
        expect(requests).toHaveLength(1);
    });

    it('does not ask again for lowercase tag names', async () => {
        const { host, params, requests } = setup(script + '<d|', scriptCompletions);
        const atTag = { isIncomplete: false, items: [{ label: 'document', sortText: '15' }] };
        expect(((await transformCompletions(atTag, params, host)) as CompletionList).items).toEqual(
            []
        );
        expect(requests).toHaveLength(0);
    });

    it('returns the original result if there are no components', async () => {
        const { host, params } = setup(script + '<|', {
            isIncomplete: false,
            items: [{ label: 'console', sortText: '15' }]
        });
        expect(await transformCompletions(null, params, host)).toBe(null);
    });

    it('does nothing without a script or outside of tag names', async () => {
        const noScript = setup('<div>\n\t<|\n</div>', scriptCompletions);
        expect(await transformCompletions(null, noScript.params, noScript.host)).toBe(null);
        expect(noScript.requests).toHaveLength(0);

        const expression = setup(script + '{a <|}', scriptCompletions);
        expect(await transformCompletions(null, expression.params, expression.host)).toBe(null);
        const list = { isIncomplete: false, items: [{ label: 'count' }] };
        const inExpression = setup(script + '{count < c|}', scriptCompletions);
        expect(
            (
                (await transformCompletions(
                    list,
                    inExpression.params,
                    inExpression.host
                )) as CompletionList
            ).items
        ).toEqual(list.items);
        expect(inExpression.requests).toHaveLength(0);
    });

    it('falls back when the extra request fails', async () => {
        const { host, params } = setup(script + '<|', undefined);
        expect(await transformCompletions(null, params, host)).toBe(null);
    });
});

describe('transformCompletions without a usable script', () => {
    function setupNoScript(textWithCursor: string) {
        const offset = textWithCursor.indexOf('|');
        const text = textWithCursor.slice(0, offset) + textWithCursor.slice(offset + 1);
        const lineStarts = [0, ...[...text.matchAll(/\n/g)].map((m) => m.index! + 1)];
        const positionAt = (o: number) => {
            const line = lineStarts.filter((start) => start <= o).length - 1;
            return { line, character: o - lineStarts[line] };
        };
        const requests: { line: number; character: number }[] = [];
        const host: CompletionMiddlewareHost = {
            cache: {},
            importEditOptions: { newScriptTag: '<script lang="ts">' },
            getDocument: () => ({
                getText: () => text,
                offsetAt: (p) => lineStarts[p.line] + p.character,
                positionAt
            }),
            requestCompletions: async (_uri, position) => {
                requests.push(position);
                // what TS7 returns inside the tag name: auto-imports with an edit after the `<`
                return {
                    isIncomplete: false,
                    items: [
                        {
                            label: 'Child__SvelteComponent_',
                            kind: 6,
                            sortText: '16',
                            data: {
                                autoImport: {
                                    name: 'Child__SvelteComponent_',
                                    moduleSpecifier: './Child.svelte'
                                }
                            },
                            additionalTextEdits: [
                                {
                                    range: {
                                        start: { line: 0, character: 1 },
                                        end: { line: 0, character: 1 }
                                    },
                                    newText:
                                        '\nimport Child__SvelteComponent_ from "./Child.svelte";\n\n'
                                }
                            ]
                        }
                    ]
                };
            }
        };
        return {
            host,
            params: { textDocument: { uri: 'file:///A.svelte' }, position: positionAt(offset) },
            requests
        };
    }

    it('asks inside the tag name at its end and wraps the import in a new script tag', async () => {
        const { host, params, requests } = setupNoScript('<Child| ');
        // TS7 at the end of the name: no auto-imports
        const atEnd: CompletionList = {
            isIncomplete: false,
            items: [{ label: 'Child', kind: 1, sortText: '18' }]
        };
        const result = (await transformCompletions(atEnd, params, host)) as CompletionList;
        expect(requests).toEqual([{ line: 0, character: 5 }]);
        expect(result.items.map((i) => i.label)).toEqual(['Child']);
        expect(result.items[0].additionalTextEdits).toEqual([
            {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                newText: '<script lang="ts">\n\timport Child from "./Child.svelte";\n</script>\n\n'
            }
        ]);
    });

    it('moves the import into an empty script', async () => {
        const { host, params, requests } = setupNoScript('<script></script>\n\n<Child|');
        const inner = host.requestCompletions;
        // inside the empty script nothing is mapped, TS7 returns null
        host.requestCompletions = async (uri, position) =>
            position.line === 0 ? (requests.push(position), null) : inner(uri, position);
        const atEnd: CompletionList = {
            isIncomplete: false,
            items: [{ label: 'Child', kind: 1, sortText: '18' }]
        };
        const result = (await transformCompletions(atEnd, params, host)) as CompletionList;
        expect(requests).toEqual([
            { line: 0, character: 8 },
            { line: 2, character: 5 }
        ]);
        expect(result.items[0].additionalTextEdits).toEqual([
            {
                range: { start: { line: 0, character: 8 }, end: { line: 0, character: 8 } },
                newText: '\n\timport Child from "./Child.svelte";\n'
            }
        ]);
    });
});

describe('renameComponentAutoImport', () => {
    it('renames resolved items, which keep our label but get the generated import back', () => {
        const resolved = {
            label: 'Child',
            insertText: 'Child',
            data: {
                autoImport: { name: 'Child__SvelteComponent_', moduleSpecifier: './Child.svelte' }
            },
            additionalTextEdits: [
                {
                    range: { start: { line: 0, character: 18 }, end: { line: 0, character: 18 } },
                    newText: '\n\timport Child__SvelteComponent_ from "./Child.svelte";\n'
                }
            ]
        };
        const result = renameComponentAutoImport(resolved);
        expect(result.label).toBe('Child');
        expect(result.additionalTextEdits?.[0].newText).toBe(
            '\n\timport Child from "./Child.svelte";\n'
        );
    });

    it('only renames auto-imports from .svelte files', () => {
        const item = {
            label: 'Button__SvelteComponent_',
            data: { autoImport: { moduleSpecifier: 'typescript' } }
        };
        expect(renameComponentAutoImport(item)).toBe(item);
        const local = { label: 'Button__SvelteComponent_' };
        expect(renameComponentAutoImport(local)).toBe(local);
    });
});
