import type {
    CompletionItem,
    CompletionList
} from '@typescript/native/vscode' with { 'resolution-mode': 'import' };

/**
 * Names that come from svelte2tsx's generated code or the svelte2tsx shims and are in scope of the
 * virtual file, but which users never write themselves.
 * Mirrors `isNoSvelte2tsxCompletion` of the TS6 CompletionProvider, plus some names that are
 * only visible with the content mapper output.
 * Superset of `isGeneratedIdentifier` in the language server
 * (`plugins/typescript-go/middleware/generatedNames.ts`), keep them in sync.
 */
const exactNames = new Set([
    // internalHelpers.renderName
    '$$render',
    '$$ComponentProps',
    'svelteHTML',
    'svelteNative',
    // svelte2tsxTypes of the TS6 CompletionProvider
    'Svelte2TsxComponent',
    'Svelte2TsxComponentConstructorParameters',
    'SvelteComponentConstructor',
    'SvelteActionReturnType',
    'SvelteTransitionConfig',
    'SvelteTransitionReturnType',
    'SvelteAnimationReturnType',
    'SvelteWithOptionalProps',
    'SvelteAllProps',
    'SveltePropsAnyFallback',
    'SvelteSlotsAnyFallback',
    'SvelteRestProps',
    'SvelteSlots',
    'SvelteStore'
]);

export function isGeneratedCompletion(label: string): boolean {
    return (
        exactNames.has(label) ||
        label.startsWith('__sveltets_') ||
        label.startsWith('$$_') ||
        // the default export class of the current component, e.g. `Button__SvelteComponent_`
        label.endsWith('__SvelteComponent_')
    );
}

export function filterGeneratedCompletions<T extends CompletionItem[] | CompletionList | null>(
    result: T
): T {
    if (!result) {
        return result;
    }
    if (Array.isArray(result)) {
        return result.filter((item) => !isGeneratedCompletion(item.label)) as T;
    }
    return {
        ...result,
        items: result.items.filter((item) => !isGeneratedCompletion(item.label))
    } as T;
}
