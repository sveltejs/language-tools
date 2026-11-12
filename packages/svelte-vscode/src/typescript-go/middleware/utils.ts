// Helpers of the TS7 middleware. No vscode dependency, so they are unit-testable.

/** What the vscode-independent parts of the middleware need from a text document */
export interface TextDocumentView {
    getText(): string;
    offsetAt(position: { line: number; character: number }): number;
    positionAt(offset: number): { line: number; character: number };
}

export function isSvelteUri(uri: string): boolean {
    return uri.endsWith('.svelte');
}

/** What `withTimeout` resolves to if the time ran out */
export const timedOut = Symbol('timedOut');

/**
 * Waits for `promise`, but not longer than `ms`. The middleware runs inside TS7's request pipeline,
 * so whatever it waits for must not hold up TypeScript features for long.
 *
 * The work behind `promise` goes on after a timeout; cancel it yourself if it can be cancelled.
 */
export async function withTimeout<T>(
    promise: PromiseLike<T>,
    ms: number
): Promise<T | typeof timedOut> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<typeof timedOut>((resolve) => {
                timer = setTimeout(() => resolve(timedOut), ms);
            })
        ]);
    } finally {
        clearTimeout(timer);
    }
}

const identifierPart = /[$\w\u0080-\uffff]/;

/**
 * Whether the identifier at `position` is a `$name`, i.e. possibly a store subscription.
 * `$$props` and friends are not (same rule as `getSubscriptionAt` in the language server).
 */
export function isAtDollarIdentifier(
    document: TextDocumentView,
    position: { line: number; character: number }
): boolean {
    const text = document.getText();
    let start = document.offsetAt(position);
    while (start > 0 && identifierPart.test(text[start - 1])) {
        start--;
    }
    return text[start] === '$' && text[start + 1] !== '$';
}
