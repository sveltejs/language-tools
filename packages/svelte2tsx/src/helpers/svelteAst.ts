import { parseHtmlx } from '../utils/htmlxparser';

export function parseTemplateOnly(
    svelte: string,
    options: {
        parse: typeof import('svelte/compiler').parse;
        emitOnTemplateError?: boolean;
        svelte5Plus: boolean;
    }
) {
    const { htmlxAst } = parseHtmlx(svelte, options.parse, options);

    return {
        htmlxAst
    };
}
