import { CompletionItem, CompletionList } from 'vscode-languageserver';

export type TsgoCompletionResult = CompletionList | CompletionItem[] | null;

/**
 * In a start tag, TS7 offers the attributes of the `svelteHTML` typings (`aria-*`, `oncopy`,
 * `on:copy`, …) and the Svelte language server the HTML/Svelte ones: VS Code would show most names
 * twice. TS items are only dropped when the Svelte LS offers the same label (also for TS's quoted
 * labels like `"aria-label"`); the rest is sorted after the Svelte LS's items.
 *
 * Unlike TS6 mode (`PluginHost.getCompletions`), `onX` is not dropped because the Svelte LS offers
 * `on:X`: that is the legacy directive, not an equivalent. For some events (e.g. `onintrostart`) the
 * Svelte LS only has the directive, and choosing it next to modern handlers is a compiler error
 * (`mixed_event_handler_syntaxes`).
 */
export function dedupeStartTagCompletions<T extends TsgoCompletionResult>(
    result: T,
    svelteLabels: ReadonlySet<string>
): T {
    if (!result || svelteLabels.size === 0) {
        return result;
    }
    const items = Array.isArray(result) ? result : result.items;
    const filtered: CompletionItem[] = [];
    for (const item of items) {
        let label = item.label;
        if (svelteLabels.has(label)) {
            continue;
        }
        if (label.length > 1 && label.startsWith('"') && label.endsWith('"')) {
            // would be a wrong completion regardless, remove the quotes
            label = label.slice(1, -1);
            if (svelteLabels.has(label)) {
                // "aria-label" -> aria-label -> offered by the Svelte LS
                continue;
            }
        }
        filtered.push({ ...item, label, sortText: 'Z' + (item.sortText || '') });
    }
    return (Array.isArray(result) ? filtered : { ...result, items: filtered }) as T;
}
