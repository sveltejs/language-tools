/**
 * svelte-check on TypeScript 7 (content mapper). Exported as `svelte-language-server/svelte-check-ts7`.
 *
 * Nothing in here loads TypeScript 6 when it's loaded, unlike the package's main entry
 * (which is the language server and the TS6 `SvelteCheck`).
 */
export { SvelteCheckTs7 } from './SvelteCheckTs7';
export type {
    SvelteCheckTs7Options,
    SvelteCheckFileDiagnostics,
    FileChange
} from './SvelteCheckTs7';
export type { TypeScript7Modules } from './project';
export { SvelteCheckTs7Error, CONTENT_MAPPER_PACKAGE } from './infrastructure';
// for svelte-check's output, which both paths share
export { offsetAt } from '../lib/documents/utils';
