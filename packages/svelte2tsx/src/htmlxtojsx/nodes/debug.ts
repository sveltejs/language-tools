import { Node } from 'estree-walker';
import MagicString from 'magic-string';

/**
 * {@debug a}		--->   {a}
 *
 * tsx won't accept commas, must split
 * {@debug a, b}	--->   {a}{b}
 */
export function handleDebug(_htmlx: string, str: MagicString, debugBlock: Node): void {
    str.overwrite(
        debugBlock.start,
        debugBlock.end,
        debugBlock.identifiers.map((identifier: Node) => `{${identifier.name}}`).join('')
    );
}
