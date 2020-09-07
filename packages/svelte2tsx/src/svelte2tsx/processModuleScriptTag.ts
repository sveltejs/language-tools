import MagicString from 'magic-string';
import { Node } from 'estree-walker';
export function processModuleScriptTag(str: MagicString, script: Node) {
    const htmlx = str.original;

    const scriptStartTagEnd = htmlx.indexOf('>', script.start) + 1;
    const scriptEndTagStart = htmlx.lastIndexOf('<', script.end - 1);

    str.overwrite(script.start, scriptStartTagEnd, '</>;');
    str.overwrite(scriptEndTagStart, script.end, ';<>');
}
