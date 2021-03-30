import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';

/**
 * {@debug a}		--->   {a}
 * {@debug a, b}	--->   {a}{b}
 * tsx won't accept commas, must split
 */
export function handleDebug(_htmlx: string, str: MagicString, debugBlock: BaseNode): void {
    let cursor = debugBlock.start;
    for (const identifier of debugBlock.identifiers as BaseNode[]) {
        str.remove(cursor, identifier.start);
        str.prependLeft(identifier.start, '{');
        str.prependLeft(identifier.end, '}');
        cursor = identifier.end;
    }
    str.remove(cursor, debugBlock.end);
}
