import { parseOptions } from './options';
import { exitAfterFlush, instantiateWriter } from './output';
import { getTypeScript6Problem } from './typescriptVersions';

parseOptions(async (opts) => {
    if (!opts.experimentalTs7) {
        // Before loading the TypeScript 6 chunk, which fails to load with TypeScript 7
        const problem = getTypeScript6Problem();
        if (problem) {
            instantiateWriter(opts).failure(new Error(problem));
            exitAfterFlush(1);
            return;
        }
    }
    try {
        // Separate chunks: only the TypeScript 6 path (the default) requires TypeScript 6 when it's
        // loaded. The TypeScript 7 path doesn't need it.
        const { run } = opts.experimentalTs7 ? await import('./ts7') : await import('./ts6');
        await run(opts);
    } catch (_err) {
        console.error(_err);
        console.error('svelte-check failed');
        // A failed run must not look like a clean one to CI.
        exitAfterFlush(1);
    }
});
