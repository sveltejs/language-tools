import { Node } from 'estree-walker';
import MagicString from 'magic-string';

/**
 * {@debug a}		--->   {a}
 * {@debug a, b}	--->   {a}{b}
 * tsx won't accept commas, must split
 */
export function handleDebug(_htmlx: string, str: MagicString, debugBlock: Node): void {
    let cursor = debugBlock.start;
    for (const identifier of debugBlock.identifiers as Node[]) {
        str.remove(cursor, identifier.start);
        str.appendRight(identifier.start, '{');
        str.prependLeft(identifier.end, '}');
        cursor = identifier.end;
    }
    str.remove(cursor, debugBlock.end);
}
