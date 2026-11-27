import { svelte2tsx as svelte2tsxWithFacade, type Svelte2TsxOptions } from '../src/svelte2tsx';
import { htmlx2jsx as htmlx2jsxWithFacade } from '../src/htmlxtojsx_v2';
import type { TsFacade } from '../src/facade';
import { tsFacade } from '../src/ts-facade';
import { createTsgoFacade } from '../src/tsgo-facade';

/**
 * Which TypeScript the tests run svelte2tsx with: TypeScript 6 (`ts`, default)
 * or TypeScript 7 (`tsgo`, through `SVELTE2TSX_TS=tsgo` or `--tsgo`).
 * Both must produce the same output, so they share the expected files.
 */
export const tsMode: 'ts' | 'tsgo' =
    process.env.SVELTE2TSX_TS === 'tsgo' || process.argv.includes('--tsgo') ? 'tsgo' : 'ts';

export const facade: TsFacade =
    tsMode === 'tsgo'
        ? createTsgoFacade({
              ast: require('@typescript/native/ast'),
              sync: require('@typescript/native/sync')
          })
        : tsFacade;

export function svelte2tsx(svelte: string, options: Svelte2TsxOptions = {}) {
    return svelte2tsxWithFacade(svelte, { ...options, typescript: facade });
}

export function htmlx2jsx(
    htmlx: string,
    parse: typeof import('svelte/compiler').parse,
    options: Omit<Parameters<typeof htmlx2jsxWithFacade>[2], 'typescript'>
) {
    return htmlx2jsxWithFacade(htmlx, parse, { ...options, typescript: facade });
}
