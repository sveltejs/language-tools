import { parseOptions } from './options';
import { exitAfterFlush } from './output';

parseOptions(async (opts) => {
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
