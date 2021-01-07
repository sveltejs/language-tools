import { Range, SemanticTokens } from 'vscode-languageserver';
import { Document } from '../../lib/documents';
import { flatten, isNotNullOrUndefined } from '../../utils';
import { Plugin } from '../interfaces';

export async function collectSemanticTokens(
    plugins: Plugin[],
    textDocument: Document,
    range?: Range
): Promise<SemanticTokens> {
    const partials = (await Promise.all(
        plugins.map(plugin => plugin.getSemanticTokens?.(textDocument, range))
    )).filter(isNotNullOrUndefined);

    return {
        data: flatten(partials.map(p => p.data))
    };
}
