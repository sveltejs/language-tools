/**
 * Validates the `svelteOptions.looseAttributePrefixes` tsconfig value, which is
 * unchecked user input. Non-string and empty-string entries are dropped (an empty
 * string would match every attribute and silently disable attribute checking).
 */
export function sanitizeLooseAttributePrefixes(prefixes: unknown): string[] | undefined {
    if (!Array.isArray(prefixes)) {
        return undefined;
    }
    const sanitized = prefixes.filter(
        (prefix): prefix is string => typeof prefix === 'string' && prefix.length > 0
    );
    return sanitized.length > 0 ? sanitized : undefined;
}
