import { describe, expect, it } from 'vitest';
import {
    getTagNameContext,
    isComponentTagCandidate
} from '../src/typescript-go/middleware/componentTagText';

/** `|` marks the cursor */
function context(textWithCursor: string) {
    const offset = textWithCursor.indexOf('|');
    const text = textWithCursor.slice(0, offset) + textWithCursor.slice(offset + 1);
    return { text, result: getTagNameContext(text, offset) };
}

const script = '<script lang="ts">\n\timport Child from "./Child.svelte";\n</script>\n';

describe('getTagNameContext', () => {
    it('finds a tag name position after `<`', () => {
        const { text, result } = context(script + '<div>\n\t<|\n</div>');
        expect(result?.word).toBe('');
        expect(text.slice(0, result!.scriptQueryOffset)).toBe('<script lang="ts">');
    });

    it('queries at the end of the script if it does not start with a line break', () => {
        const { text, result } = context('<script>let a;</script>\n<|');
        expect(text.slice(0, result!.scriptQueryOffset)).toBe('<script>let a;');
    });

    it('finds a partially typed tag name', () => {
        expect(context(script + '<div>\n\t<Ch|\n</div>').result?.word).toBe('Ch');
        expect(context(script + '<Ch|').result?.word).toBe('Ch');
    });

    it('prefers the instance script over the module script', () => {
        const { text, result } = context(
            '<script module>\n\texport const a = 1;\n</script>\n' + script + '<|'
        );
        expect(text.slice(0, result!.scriptQueryOffset)).toMatch(/<\/script>\n<script lang="ts">$/);
        const legacy = context(
            '<script context="module">\n\texport const a = 1;\n</script>\n' + script + '<|'
        );
        expect(legacy.text.slice(0, legacy.result!.scriptQueryOffset)).toMatch(
            /<\/script>\n<script lang="ts">$/
        );
    });

    it('falls back to the module script', () => {
        const { text, result } = context('<script module>\n\tlet a;\n</script>\n<|');
        expect(text.slice(0, result!.scriptQueryOffset)).toBe('<script module>');
    });

    it('works without a script', () => {
        expect(context('<div>\n\t<|\n</div>').result).toEqual({
            word: '',
            scriptQueryOffset: undefined
        });
    });

    it('ignores script and style contents', () => {
        expect(context('<script lang="ts">\n\tlet a: Array<|\n</script>').result).toBe(undefined);
        expect(context('<script lang="ts">\n\tif (a <|) {}\n</script>\n<div />').result).toBe(
            undefined
        );
        expect(context('<style>\n\ta <|\n</style>').result).toBe(undefined);
    });

    it('ignores expressions', () => {
        expect(context(script + '{a <|}').result).toBe(undefined);
        expect(context(script + '{#if a <b|}{/if}').result).toBe(undefined);
        expect(context(script + '<div onclick={() => a <|}></div>').result).toBe(undefined);
        expect(context(script + '{"}" + (a <|)}').result).toBe(undefined);
    });

    it('allows tags after closed expressions and blocks', () => {
        expect(context(script + '{#if a}\n\t<|\n{/if}').result?.word).toBe('');
        expect(context(script + '<p>{"{"}</p>\n<C|').result?.word).toBe('C');
    });

    it('ignores comments', () => {
        expect(context(script + '<!-- <| -->').result).toBe(undefined);
        expect(context(script + '<!-- x -->\n<|').result?.word).toBe('');
    });

    it('ignores member access and non-tag positions', () => {
        expect(context(script + '<ui.|').result).toBe(undefined);
        expect(context(script + '<div |').result).toBe(undefined);
        expect(context(script + 'text|').result).toBe(undefined);
    });
});

describe('isComponentTagCandidate', () => {
    it('accepts uppercase names only', () => {
        expect(isComponentTagCandidate('Child')).toBe(true);
        expect(isComponentTagCandidate('child')).toBe(false);
        expect(isComponentTagCandidate('$state')).toBe(false);
    });
});
