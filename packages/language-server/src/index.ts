export * from './server';
export { offsetAt, positionAt, getLineOffsets } from './lib/documents';
export { normalizePath } from './utils';
export { defaultKitFilesSettings, resolveKitFilesSettings } from './lib/documents/configLoader';
export type { KitFilesConfig } from './lib/documents/configLoader';
export {
    mapSvelteCheckDiagnostics,
    SvelteCheck,
    SvelteCheckDiagnosticSource,
    SvelteCheckOptions
} from './svelte-check';
