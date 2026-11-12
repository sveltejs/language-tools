// The main entry point: svelte2tsx with TypeScript 6 (or 5, 4.9).
// See `tsgo.ts` for the one with TypeScript 7.
import { svelte2tsx as svelte2tsxWithFacade, type Svelte2TsxOptions } from './svelte2tsx';
import { tsFacade } from './ts-facade';

export function svelte2tsx(svelte: string, options: Svelte2TsxOptions = {}) {
    return svelte2tsxWithFacade(svelte, {
        ...options,
        typescript: options.typescript ?? tsFacade
    });
}

export { emitDts } from './emitDts';
export { internalHelpers } from './helpers';
