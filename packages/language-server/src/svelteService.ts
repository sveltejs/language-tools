import type { LanguageServicePlugin, LanguageServicePluginInstance } from '@volar/language-service';
import type { CancellationToken } from 'vscode-languageserver-protocol';
import {
    CompletionItem,
    CompletionItemKind,
    CompletionList,
    Hover,
    InsertTextFormat,
    MarkupKind,
    Position,
    Range,
} from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Svelte-specific service plugin for Volar
 * Provides Svelte template completions, diagnostics, and hover information
 */
export function create(): LanguageServicePlugin {
    return {
        name: 'svelte',
        capabilities: {
            completionProvider: {
                triggerCharacters: ['{', '#', ':', '/', '@', '|'],
            },
            hoverProvider: true,
        },
        create(_context): LanguageServicePluginInstance {
            return {
                provideCompletionItems(
                    document: TextDocument,
                    position: Position,
                    _completionContext: unknown,
                    token: CancellationToken
                ) {
                    if (token.isCancellationRequested) {
                        return null;
                    }

                    if (document.languageId !== 'svelte') {
                        return null;
                    }

                    return getSvelteCompletions(document, position);
                },

                provideHover(
                    document: TextDocument,
                    position: Position,
                    token: CancellationToken
                ) {
                    if (token.isCancellationRequested) {
                        return null;
                    }

                    if (document.languageId !== 'svelte') {
                        return null;
                    }

                    return getSvelteHover(document, position);
                },
            };
        },
    };
}

// Svelte tag documentation
const svelteTagDocs: Record<string, string> = {
    if: '`{#if expression}...{/if}`\n\nConditionally renders content based on the expression.',
    each: '`{#each expression as name}...{/each}`\n\nIterates over an array or iterable.',
    await: '`{#await expression}...{:then name}...{:catch name}...{/await}`\n\nHandles promises with loading, success, and error states.',
    key: '`{#key expression}...{/key}`\n\nDestroys and recreates content when the expression changes.',
    snippet: '`{#snippet name(params)}...{/snippet}`\n\nDefines a reusable snippet of markup (Svelte 5).',
    html: '`{@html expression}`\n\nRenders raw HTML. Be careful of XSS attacks!',
    debug: '`{@debug variables}`\n\nLogs variables and pauses execution when devtools are open.',
    const: '`{@const name = expression}`\n\nDefines a local constant in the template.',
    render: '`{@render snippet(args)}`\n\nRenders a snippet (Svelte 5).',
    attach: '`{@attach action}`\n\nAttaches an action to an element (Svelte 5).',
};

// Svelte event modifiers
const eventModifiers = [
    { modifier: 'preventDefault', documentation: 'Calls `event.preventDefault()` before running the handler.' },
    { modifier: 'stopPropagation', documentation: 'Calls `event.stopPropagation()` to prevent the event from reaching the next element.' },
    { modifier: 'stopImmediatePropagation', documentation: 'Calls `event.stopImmediatePropagation()` to prevent other listeners of the same event.' },
    { modifier: 'passive', documentation: 'Improves scrolling performance on touch/wheel events.' },
    { modifier: 'nonpassive', documentation: 'Explicitly sets `passive: false`.' },
    { modifier: 'capture', documentation: 'Fires the handler during the capture phase instead of the bubbling phase.' },
    { modifier: 'once', documentation: 'Removes the handler after the first time it runs.' },
    { modifier: 'self', documentation: 'Only triggers handler if `event.target` is the element itself.' },
    { modifier: 'trusted', documentation: 'Only triggers handler if `event.isTrusted` is true.' },
];

function getSvelteCompletions(document: TextDocument, position: Position): CompletionList | null {
    const text = document.getText();
    const offset = document.offsetAt(position);
    
    // Get the text before the cursor (last 20 characters should be enough)
    const textBefore = text.substring(Math.max(0, offset - 20), offset);
    
    // Check for Svelte block tag completions
    const blockTagMatch = textBefore.match(/\{\s*([#:/@])\s*(\w*)$/);
    if (blockTagMatch) {
        const triggerChar = blockTagMatch[1];
        const partialTag = blockTagMatch[2];
        return getBlockTagCompletions(triggerChar, partialTag);
    }

    // Check for event modifier completions
    const modifierMatch = textBefore.match(/on:\w+\|(\w*)$/);
    if (modifierMatch) {
        return getEventModifierCompletions(modifierMatch[1]);
    }

    // Check for @component documentation completion
    if (textBefore.includes('<!--')) {
        const commentMatch = textBefore.match(/<!--\s*@?(\w*)$/);
        if (commentMatch) {
            return getComponentDocCompletions(commentMatch[1]);
        }
    }

    return null;
}

function getBlockTagCompletions(triggerChar: string, _partial: string): CompletionList {
    const items: CompletionItem[] = [];

    if (triggerChar === '#') {
        // Opening block tags
        items.push(
            createSnippetCompletion('if', 'if $1}\n\t$2\n{/if', svelteTagDocs.if),
            createSnippetCompletion('each', 'each $1 as $2}\n\t$3\n{/each', svelteTagDocs.each),
            createSnippetCompletion('await', 'await $1}\n\t$2\n{:then $3}\n\t$4\n{/await', svelteTagDocs.await),
            createSnippetCompletion('await then', 'await $1 then $2}\n\t$3\n{/await', svelteTagDocs.await),
            createSnippetCompletion('key', 'key $1}\n\t$2\n{/key', svelteTagDocs.key),
            createSnippetCompletion('snippet', 'snippet $1($2)}\n\t$3\n{/snippet', svelteTagDocs.snippet),
        );
    } else if (triggerChar === ':') {
        // Continuation block tags
        items.push(
            createKeywordCompletion('else', 'Else branch for `{#if}` or `{#each}` blocks.'),
            createKeywordCompletion('else if', 'Else-if branch for `{#if}` blocks.'),
            createKeywordCompletion('then', 'Success branch for `{#await}` blocks.'),
            createKeywordCompletion('catch', 'Error branch for `{#await}` blocks.'),
        );
    } else if (triggerChar === '/') {
        // Closing block tags
        items.push(
            createKeywordCompletion('if', 'Closes an `{#if}` block.'),
            createKeywordCompletion('each', 'Closes an `{#each}` block.'),
            createKeywordCompletion('await', 'Closes an `{#await}` block.'),
            createKeywordCompletion('key', 'Closes a `{#key}` block.'),
            createKeywordCompletion('snippet', 'Closes a `{#snippet}` block.'),
        );
    } else if (triggerChar === '@') {
        // Special tags
        items.push(
            createKeywordCompletion('html', svelteTagDocs.html),
            createKeywordCompletion('debug', svelteTagDocs.debug),
            createKeywordCompletion('const', svelteTagDocs.const),
            createKeywordCompletion('render', svelteTagDocs.render),
            createKeywordCompletion('attach', svelteTagDocs.attach),
        );
    }

    return CompletionList.create(items, false);
}

function getEventModifierCompletions(partial: string): CompletionList {
    const items = eventModifiers
        .filter(m => m.modifier.startsWith(partial))
        .map(m => ({
            label: m.modifier,
            kind: CompletionItemKind.EnumMember,
            documentation: {
                kind: MarkupKind.Markdown,
                value: m.documentation,
            },
            sortText: '0',
        }));

    return CompletionList.create(items, false);
}

function getComponentDocCompletions(partial: string): CompletionList {
    if ('component'.startsWith(partial) || partial === '') {
        return CompletionList.create([{
            label: '@component',
            kind: CompletionItemKind.Snippet,
            insertText: 'component\n$1\n',
            insertTextFormat: InsertTextFormat.Snippet,
            documentation: {
                kind: MarkupKind.Markdown,
                value: 'Documentation for this component.\nIt will show up on hover. You can use markdown and code blocks here.',
            },
            sortText: '-1',
            preselect: true,
        }], false);
    }
    return CompletionList.create([], false);
}

function createSnippetCompletion(label: string, insertText: string, documentation: string): CompletionItem {
    return {
        label,
        kind: CompletionItemKind.Snippet,
        insertText,
        insertTextFormat: InsertTextFormat.Snippet,
        documentation: {
            kind: MarkupKind.Markdown,
            value: documentation,
        },
        sortText: '-1',
        preselect: true,
    };
}

function createKeywordCompletion(label: string, documentation: string): CompletionItem {
    return {
        label,
        kind: CompletionItemKind.Keyword,
        documentation: {
            kind: MarkupKind.Markdown,
            value: documentation,
        },
        sortText: '-1',
        preselect: true,
    };
}

function getSvelteHover(document: TextDocument, position: Position): Hover | null {
    const text = document.getText();
    const offset = document.offsetAt(position);
    
    // Find the word at the current position
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    const lineEnd = text.indexOf('\n', offset);
    const line = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);
    const charInLine = offset - lineStart;
    
    // Check for Svelte block tags
    const blockTagMatch = line.match(/\{[#:/@](\w+)/g);
    if (blockTagMatch) {
        for (const match of blockTagMatch) {
            const tagName = match.replace(/\{[#:/@]/, '');
            const matchIndex = line.indexOf(match);
            if (charInLine >= matchIndex && charInLine <= matchIndex + match.length) {
                const doc = svelteTagDocs[tagName];
                if (doc) {
                    return {
                        contents: {
                            kind: MarkupKind.Markdown,
                            value: doc,
                        },
                        range: Range.create(
                            Position.create(position.line, matchIndex),
                            Position.create(position.line, matchIndex + match.length)
                        ),
                    };
                }
            }
        }
    }

    return null;
}
