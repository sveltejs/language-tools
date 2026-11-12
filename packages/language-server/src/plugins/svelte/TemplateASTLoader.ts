import { Document, DocumentManager } from '../../lib/documents';
import { internalHelpers } from 'svelte2tsx';
import { parseTemplateAst, TemplateAstWalker } from './templateAst';

export type { TemplateAstWalker } from './templateAst';

interface ASTCache {
    version: number;
    walker: TemplateAstWalker;
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

        const result = parseTemplateAst(document, internalHelpers.parseTemplateOnly);
        this.map.set(document.url, { version: document.version, walker: result });
        return result;
    }
}
