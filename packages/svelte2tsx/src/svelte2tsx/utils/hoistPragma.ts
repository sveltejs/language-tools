import MagicString from 'magic-string';
import { Node } from 'estree-walker';

// Matches comments that come before any non-comment content
const commentsRegex = /^(\s*\/\/.*\s*)*/;
// Matches lines and includes the last line with // @ts-check, // @ts-nocheck or /// <reference .../>
// [ \t\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]
// is just \s (a.k.a any whitespace character) without linebreak and vertical tab
const pragmaCommentsRegex =
    /^.*[/]{2,3}[ \t\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*(<reference\b|@ts-(no)?check)[^\n]*\n/s;

/**
 * Hoist comments until the last // @ts-check or /// <reference .../> comment
 */
export function hoistPragma(str: MagicString, scriptTag: Node) {
    const comments = str.original
        .substring(scriptTag.content.start, scriptTag.content.end)
        .match(commentsRegex);
    const pragma = comments && comments[0].match(pragmaCommentsRegex);
    if (pragma) {
        str.move(scriptTag.content.start, scriptTag.content.start + pragma[0].length, 0);
    }
}
