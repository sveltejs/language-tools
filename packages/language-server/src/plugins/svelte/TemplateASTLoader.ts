import { Document, DocumentManager } from '../../lib/documents';
import { internalHelpers } from 'svelte2tsx';
import { SvelteNodeWalker, TemplateNode, walkSvelteAst } from './features/svelte-ast-utils';

interface ASTCache {
    version: number;
    walker: {
        walkSvelteAst(walker: SvelteNodeWalker): void;
        parserError: boolean;
    };
}

export interface TemplateAstWalker {
    walkSvelteAst(walker: SvelteNodeWalker): void;
    parserError: boolean;
}

export interface TemplateAstLoader {
    loadTemplateAst(document: Document): TemplateAstWalker;
}

export class TemplateASTParseLoader implements TemplateAstLoader {
    private map: Map<string, ASTCache> = new Map();

    constructor(docManager: DocumentManager) {
        docManager.on('documentClose', (doc) => {
            this.map.delete(doc.url);
        });
    }

    loadTemplateAst(document: Document) {
        const cache = this.map.get(document.url);
        if (cache && document.version === cache.version) {
            return cache.walker;
        }

        let result: TemplateAstWalker;
        try {
            const ast = internalHelpers.parseTemplateOnly(document.getText(), {
                parse: document.compiler.parse,
                emitOnTemplateError: true,
                svelte5Plus: document.isSvelte5
            }) as TemplateNode;
            result = {
                walkSvelteAst(walker: SvelteNodeWalker) {
                    walkSvelteAst(ast.htmlxAst, walker);
                },
                parserError: false
            };
        } catch (error) {
            result = {
                walkSvelteAst() {
                    // noop
                },
                parserError: true
            };
        }
        this.map.set(document.url, { version: document.version, walker: result });
        return result;
    }
}
