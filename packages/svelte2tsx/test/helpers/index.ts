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

    it('upserts handle hook const', () => {
        upsert(
            'hooks.server.ts',
            `export const handle = async ({ event, resolve }) => {};`,
            `export const handle = async ({ event, resolve }: Parameters<import('@sveltejs/kit').Handle>[0]) : ReturnType<import('@sveltejs/kit').Handle> => {};`
        );
    });

    it('upserts GET async function', () => {
        upsert(
            '+server.ts',
            `export async function GET(e) {}`,
            `export async function GET(e: import('./$types.js').RequestEvent) : Response | Promise<Response> {}`
        );
    });

    it('upserts load const with paranthesis', () => {
        upsert(
            '+page.ts',
            `export const load = (async (e) => {});`,
            `export const load = (async (e: import('./$types.js').PageLoadEvent) => {});`
        );
    });

    it('recognizes page@', () => {
        upsert('+page@.ts', `export const ssr = true;`, `export const ssr : boolean = true;`);
    });

    it('recognizes layout@foo', () => {
        upsert('+layout@foo.ts', `export const ssr = true;`, `export const ssr : boolean = true;`);
    });
});
