import MagicString from 'magic-string';
import { BaseNode } from '../../interfaces';

/**
 * {@debug a}		--->   ;a;
 * {@debug a, b}	--->   ;a;b;
 */
export function handleDebug(str: MagicString, debugBlock: BaseNode): void {
    let cursor = debugBlock.start;
    for (const identifier of debugBlock.identifiers as BaseNode[]) {
        str.overwrite(cursor, identifier.start, ';', { contentOnly: true });
        cursor = identifier.end;
    }
    str.overwrite(cursor, debugBlock.end, ';', { contentOnly: true });
}
