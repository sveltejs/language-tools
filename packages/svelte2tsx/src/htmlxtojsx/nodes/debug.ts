import { Node } from 'estree-walker';
import MagicString from 'magic-string';

/**
 * {@debug a}		--->   {a}
 *
 * tsx won't accept commas, must split
 * {@debug a, b}	--->   {a}{b}
 */
export function handleDebug(htmlx: string, str: MagicString, debugBlock: Node): void {
    const content = htmlx.slice(debugBlock.start + '@debug'.length + 1, debugBlock.end);
    str.overwrite(
        debugBlock.start,
        debugBlock.end,
        content
            .split(',')
            .map((v) => `{${v.trim()}}`)
            .join('')
    );
}
