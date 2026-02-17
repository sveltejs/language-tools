import * as assert from 'assert';
import ts from 'typescript';
import { internalHelpers } from '../../src';

describe('Internal Helpers - upsertKitFile', () => {
    function upsert(file: string, source: string, expected: string) {
        const sourceFile = ts.createSourceFile('d', source, ts.ScriptTarget.Latest, true);
        const result = internalHelpers.upsertKitFile(
            ts,
            file,
            {
                clientHooksPath: 'hooks.client',
                paramsPath: 'params',
                serverHooksPath: 'hooks.server',
                universalHooksPath: 'hooks'
            },
            () => sourceFile
        );
        assert.strictEqual(result?.text, expected);
    }

    it('upserts +page.ts function', () => {
        upsert(
            '+page.ts',
            `export function load(e) { return e; }`,
            `export function load(e: import('./$types.js').PageLoadEvent) { return e; }`
        );
    });

    it('upserts +page.js function with jsdoc', () => {
        upsert(
            '+page.js',
            `export function load(e) { return e; }`,
            `/** @param {import('./$types.js').PageLoadEvent} e */ export function load(e) { return e; }`
        );
    });

    it('leaves +page.js function with jsdoc as is #1', () => {
        upsert(
            '+page.js',
            `/** @type {import('./$types.js').PageLoad} */ export function load(e) { return e; }`,
            `/** @type {import('./$types.js').PageLoad} */ export function load(e) { return e; }`
        );
    });

    it('leaves +page.js function with jsdoc as is #2', () => {
        upsert(
            '+page.js',
            `/** @param {import('./$types.js').PageLoadEvent} e */ export function load(e) { return e; }`,
            `/** @param {import('./$types.js').PageLoadEvent} e */ export function load(e) { return e; }`
        );
    });

    it('upserts handle hook const', () => {
        upsert(
            'hooks.server.ts',
            `export const handle = async ({ event, resolve }) => {};`,
            `export const handle = async ({ event, resolve }: Parameters<import('@sveltejs/kit').Handle>[0]) : ReturnType<import('@sveltejs/kit').Handle> => {};`
        );
    });

    it('upserts handle hook const with jsdoc', () => {
        upsert(
            'hooks.server.js',
            `export const handle = async ({ event, resolve }) => {};`,
            `export const handle = /** @type {import('@sveltejs/kit').Handle} */ async ({ event, resolve }) => {};`
        );
    });

    it('upserts GET async function', () => {
        upsert(
            '+server.ts',
            `export async function GET(e) {}`,
            `export async function GET(e: import('./$types.js').RequestEvent) : Response | Promise<Response> {}`
        );
    });

    it('upserts GET async function with jsdoc', () => {
        upsert(
            '+server.js',
            `export async function GET(e) {}`,
            `/** @type {(arg0: import('./$types.js').RequestEvent) => Response | Promise<Response>} */ export async function GET(e) {}`
        );
    });

    it('upserts load const with paranthesis', () => {
        upsert(
            '+page.ts',
            `export const load = (async (e) => {});`,
            `export const load = (async (e: import('./$types.js').PageLoadEvent) => {});`
        );
    });

    it('upserts load const with paranthesis and jsdoc', () => {
        upsert(
            '+page.js',
            `export const load = (async (e) => {});`,
            `export const load = (/** @param {import('./$types.js').PageLoadEvent} e */ async (e) => {});`
        );
    });

    it('upserts actions with jsdoc', () => {
        upsert(
            '+page.server.js',
            `export const actions = { default: async (e) => {} };`,
            `export const actions = /** @satisfies {import('./$types.js').Actions} */ ({ default: async (e) => {} });`
        );
    });

    it('recognizes page@', () => {
        upsert('+page@.ts', `export const ssr = true;`, `export const ssr : boolean = true;`);
    });

    it('recognizes page@ with jsdoc', () => {
        upsert(
            '+page@.js',
            `export const ssr = true;`,
            `export const ssr = /** @type {boolean} */ (true);`
        );
    });

    it('recognizes layout@foo', () => {
        upsert('+layout@foo.ts', `export const ssr = true;`, `export const ssr : boolean = true;`);
    });

    it('recognizes layout@foo with jsdoc', () => {
        upsert(
            '+layout@foo.js',
            `export const ssr = true;`,
            `export const ssr = /** @type {boolean} */ (true);`
        );
    });
});
