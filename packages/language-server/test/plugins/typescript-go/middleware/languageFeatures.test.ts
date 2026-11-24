import assert from 'assert';
import { InlayHint, InlayHintKind, Location, Range } from 'vscode-languageserver';
import {
    transformHover,
    transformInlayHints,
    transformLocations,
    transformSignatureHelp
} from '../../../../src/plugins/typescript-go/middleware/languageFeatures';
import { replaceGeneratedNames } from '../../../../src/plugins/typescript-go/middleware/generatedNames';

/** Inputs are trimmed copies of what TS7 (7.1.0-dev.20261103.1) returned for Svelte files */
describe('TS7 middleware language feature transforms', () => {
    describe('signature help', () => {
        it('drops generated helper signatures', () => {
            // inside `{#each [1, 2] as item}`
            assert.strictEqual(
                transformSignatureHelp({
                    signatures: [
                        {
                            label: '__sveltets_2_ensureArray(array: number[] | null | undefined): number[]',
                            parameters: [{ label: 'array: number[] | null | undefined' }]
                        }
                    ],
                    activeSignature: 0,
                    activeParameter: 0
                }),
                null
            );
            // inside `<Child foo={|} />`
            assert.strictEqual(
                transformSignatureHelp({
                    signatures: [
                        {
                            label: '$$_dlihC0C(options: ComponentConstructorOptions<$$ComponentProps>): SvelteComponent<$$ComponentProps, unknown, unknown>'
                        }
                    ],
                    activeSignature: 0
                }),
                null
            );
        });

        it('keeps user signatures and fixes the active index', () => {
            const user = { label: 'add(first: number, second: number): number' };
            assert.deepStrictEqual(
                transformSignatureHelp({
                    signatures: [{ label: '__sveltets_2_any(dummy: any): any' }, user],
                    activeSignature: 1,
                    activeParameter: 1
                }),
                { signatures: [user], activeSignature: 0, activeParameter: 1 }
            );
            const result = { signatures: [user], activeSignature: 0 };
            assert.strictEqual(transformSignatureHelp(result), result);
        });
    });

    describe('hover', () => {
        it('replaces the generated component export name', () => {
            const range = Range.create(13, 1, 13, 6);
            assert.deepStrictEqual(
                transformHover({
                    contents: {
                        kind: 'markdown',
                        value: '```typescript\n(alias) const Child__SvelteComponent_: Component<$$ComponentProps, {}, "">\n```\n'
                    },
                    range
                }),
                {
                    contents: {
                        kind: 'markdown',
                        value: '```typescript\n(alias) const Child: Component<$$ComponentProps, {}, "">\n```\n'
                    },
                    range
                }
            );
        });

        it('drops hovers of generated declarations', () => {
            assert.strictEqual(
                transformHover({
                    contents: {
                        kind: 'markdown',
                        value: '```typescript\nfunction __sveltets_2_ensureArray<T>(array: T): T\n```\n'
                    }
                }),
                null
            );
        });

        it('keeps other hovers', () => {
            const hover = {
                contents: {
                    kind: 'markdown' as const,
                    value: '```typescript\nlet value: number\n```\n'
                }
            };
            assert.deepStrictEqual(transformHover(hover), hover);
        });
    });

    it('replaces generated names in text', () => {
        assert.strictEqual(
            replaceGeneratedNames("Type 'typeof Foo__SvelteComponent_' is not assignable"),
            "Type 'typeof Foo' is not assignable"
        );
    });

    it('dedupes inlay hints of split nodes', () => {
        // `{add(item, index)}` inside an each block: TS7 returned each hint three times
        const first: InlayHint = {
            position: { line: 13, character: 6 },
            label: 'first:',
            kind: InlayHintKind.Parameter,
            paddingRight: true
        };
        const second: InlayHint = {
            position: { line: 13, character: 12 },
            label: 'second:',
            kind: InlayHintKind.Parameter,
            paddingRight: true
        };
        assert.deepStrictEqual(
            transformInlayHints([
                first,
                second,
                { ...first },
                { ...second },
                { ...first },
                { ...second }
            ]),
            [first, second]
        );
    });

    describe('locations', () => {
        const shim = Location.create(
            'file:///repo/node_modules/svelte2tsx/svelte-shims-v4.d.ts',
            Range.create(1, 1, 1, 5)
        );
        const jsx = Location.create(
            'file:///repo/node_modules/.pnpm/svelte2tsx%400.7.0/node_modules/svelte2tsx/svelte-jsx-v4.d.ts',
            Range.create(1, 1, 1, 5)
        );
        const user = Location.create('file:///repo/src/Child.svelte', Range.create(1, 31, 1, 36));

        it('drops svelte2tsx shim locations and duplicates', () => {
            assert.deepStrictEqual(transformLocations([shim, user, jsx, { ...user }]), [user]);
            assert.strictEqual(transformLocations(shim), null);
            assert.strictEqual(transformLocations(user), user);
        });

        it('handles location links', () => {
            const link = {
                targetUri: shim.uri,
                targetRange: shim.range,
                targetSelectionRange: shim.range
            };
            assert.deepStrictEqual(transformLocations([link]), []);
        });
    });
});
