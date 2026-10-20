import { htmlx2jsx } from '../build';
import assert from 'assert';
import { benchmark } from '../helpers';
import { parse } from 'svelte/compiler';
import { extractScriptTags } from '../../src/utils/htmlxparser';

describe('htmlxparser', () => {
    describe('extractScriptTags', () => {
        const instance = '<script lang="ts">let name: string = "hello";</script>';
        const nested = '<script>window.foo = 1;</script>';

        for (const template of [
            `<svelte:head>${nested}</svelte:head>`,
            `<div>${nested}</div>`,
            `{#if true}${nested}{/if}`,
            `{@html '${nested}'}`
        ]) {
            it(`ignores template scripts in ${template}`, () => {
                const source = template + instance;
                const scripts = extractScriptTags(source);

                assert.strictEqual(scripts.instance.start, template.length);
                assert.strictEqual(scripts.instance.attributes.lang, 'ts');
                assert.strictEqual(
                    source.slice(scripts.instance.content.start, scripts.instance.content.end),
                    'let name: string = "hello";'
                );
                assert.strictEqual(scripts.module, undefined);
            });
        }

        it('does not treat a nested script as a component script', () => {
            assert.deepStrictEqual(extractScriptTags(`<svelte:head>${nested}</svelte:head>`), {
                instance: undefined,
                module: undefined
            });
        });

        it('detects both top-level script contexts', () => {
            const module = '<script context="module" lang="ts">export const value = 1;</script>';
            const scripts = extractScriptTags(
                `<svelte:head>${nested}</svelte:head>` + module + instance
            );

            assert.strictEqual(scripts.module.attributes.context, 'module');
            assert.strictEqual(scripts.module.attributes.lang, 'ts');
            assert.strictEqual(scripts.instance.attributes.lang, 'ts');
        });

        it('retains the script fallback when the template is invalid', () => {
            const scripts = extractScriptTags(instance + '{#if}');
            assert.strictEqual(scripts.instance.start, 0);
            assert.strictEqual(scripts.instance.attributes.lang, 'ts');
        });
    });

    it('parses in a reasonable time', () => {
        let random = '';
        let str = '';
        for (let i = 0; i !== 17; i++) random += Math.random().toString(26).slice(2);
        for (let i = 0; i !== 1137; i++) str += `${random} - line\t${i}\n`;
        const duration = benchmark(
            htmlx2jsx.bind(null, `<script> ${str} </script>` + `<style> ${str} </style>`, parse)
        );
        assert(duration <= 1000, `Parsing took ${duration} ms, which was longer than 1000ms`);
    });
});
