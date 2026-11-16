import type { internalHelpers } from 'svelte2tsx';
import type { Document } from '../../lib/documents';
import { SvelteNodeWalker, TemplateNode, walkSvelteAst } from './features/svelte-ast-utils';

export interface TemplateAstWalker {
    walkSvelteAst(walker: SvelteNodeWalker): void;
    parserError: boolean;
}

/**
 * Parses the template of `document` (scripts and styles are blanked out).
 *
 * svelte2tsx's parser is passed in rather than imported, so that this module doesn't load
 * svelte2tsx (and with it TypeScript 6) when it's loaded.
 */
export function parseTemplateAst(
    document: Document,
    parseTemplateOnly: typeof internalHelpers.parseTemplateOnly
): TemplateAstWalker {
    try {
        const ast = parseTemplateOnly(document.getText(), {
            parse: document.compiler.parse,
            emitOnTemplateError: true,
            svelte5Plus: document.isSvelte5
        }) as TemplateNode;
        return {
            walkSvelteAst(walker: SvelteNodeWalker) {
                walkSvelteAst(ast.htmlxAst, walker);
            },
            parserError: false
        };
    } catch (error) {
        return {
            walkSvelteAst() {
                // noop
            },
            parserError: true
        };
    }
}
