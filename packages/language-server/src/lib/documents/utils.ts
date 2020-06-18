import { clamp, isInRange } from '../../utils';
import { Position, Range } from 'vscode-languageserver';
import parse5, { Location } from 'parse5';

export interface TagInformation {
    content: string;
    attributes: Record<string, string>;
    start: number;
    end: number;
    startPos: Position;
    endPos: Position;
    container: { start: number; end: number };
}

function parseAttributes(attrlist: { name: string; value: string }[]): Record<string, string> {
    const attrs: Record<string, string> = {};
    attrlist.forEach((attr) => {
        attrs[attr.name] = attr.value === '' ? attr.name : attr.value; // in order to support boolean attributes (see utils.test.ts)
    });
    return attrs;
}

function isMatchingTag(source: string, node: ParsedNode, tag: string): boolean {
    if (node.nodeName !== tag) {
        return false;
    }

    // node name equals tag, but we still have to check for case sensitivity
    const orgStart = node.sourceCodeLocation?.startTag.startOffset || 0;
    const orgEnd = node.sourceCodeLocation?.startTag.endOffset || 0;
    const tagHtml = source.substring(orgStart, orgEnd);
    return tagHtml.startsWith(`<${tag}`);
}

// parse5's DefaultTreeNode type is insufficient; make our own type to make TS happy
type ParsedNode = {
    nodeName: string;
    tagName: string;
    value?: string;
    attrs: { name: string; value: string }[];
    childNodes: ParsedNode[];
    parentNode: ParsedNode;
    sourceCodeLocation: Location & { startTag: Location; endTag: Location };
};

const regexIf = new RegExp('{#if\\s(.*?)*}', 'igms');
const regexIfEnd = new RegExp('{/if}', 'igms');
const regexEach = new RegExp('{#each\\s(.*?)*}', 'igms');
const regexEachEnd = new RegExp('{/each}', 'igms');
const regexAwait = new RegExp('{#await\\s(.*?)*}', 'igms');
const regexAwaitEnd = new RegExp('{/await}', 'igms');

/**
 * Extracts a tag (style or script) from the given text
 * and returns its start, end and the attributes on that tag.
 *
 * @param source text content to extract tag from
 * @param tag the tag to extract
 */
export function extractTag(source: string, tag: 'script' | 'style'): TagInformation | null {
    const { childNodes } = parse5.parseFragment(source, {
        sourceCodeLocationInfo: true,
    }) as { childNodes: ParsedNode[] };

    let matchedNode;
    let currentSvelteDirective;
    for (const node of childNodes) {
        /**
         * skip matching tags if we are inside a directive
         *
         * extractTag's goal is solely to identify the top level <script> or <style>.
         *
         * therefore only iterating through top level childNodes is a feature we want!
         *
         * however, we cannot do a naive childNodes.find() because context matters.
         * if we have a <script> tag inside an {#if}, we want to skip that until the {/if}.
         * if we have a <script> tag inside an {#each}, we want to skip that until the {/each}.
         * if we have a <script> tag inside an {#await}, we want to skip that until the {/await}.
         *
         * and so on. So we use a tiny inSvelteDirective 'state machine' to track this
         * and use regex to detect the svelte directives.
         * We might need to improve this regex in future.
         */
        if (currentSvelteDirective) {
            if (node.value && node.nodeName === '#text') {
                if (
                    (currentSvelteDirective === 'if' && regexIfEnd.exec(node.value)) ||
                    (currentSvelteDirective === 'each' && regexEachEnd.exec(node.value)) ||
                    (currentSvelteDirective === 'await' && regexAwaitEnd.exec(node.value))
                ) {
                    currentSvelteDirective = undefined;
                }
            }
        } else {
            if (node.value && node.nodeName === '#text') {
                // potentially a svelte directive
                if (regexIf.exec(node.value)) currentSvelteDirective = 'if';
                else if (regexEach.exec(node.value)) currentSvelteDirective = 'each';
                else if (regexAwait.exec(node.value)) currentSvelteDirective = 'await';
            } else if (isMatchingTag(source, node, tag)) {
                matchedNode = node;
                break;
            }
        }
    }
    if (matchedNode === undefined) return null; // no match at all; early return

    const SCL = matchedNode.sourceCodeLocation; // shorthand
    const attributes = parseAttributes(matchedNode.attrs);
    /**
     * Note: `content` will only show top level child node content.
     * This is ok given that extractTag is only meant to extract top level
     * <style> and <script> tags. But if that ever changes we may have to make this
     * recurse and concat all childnodes.
     */
    const content = matchedNode.childNodes[0]?.value || '';
    const start = SCL.startTag.endOffset;
    const end = SCL.endTag.startOffset;
    const startPos = positionAt(start, source);
    const endPos = positionAt(end, source);
    const container = {
        start: SCL.startTag.startOffset,
        end: SCL.endTag.endOffset,
    };

    return {
        content,
        attributes,
        start,
        end,
        startPos,
        endPos,
        container,
    };
}

/**
 * Get the line and character based on the offset
 * @param offset The index of the position
 * @param text The text for which the position should be retrived
 */
export function positionAt(offset: number, text: string): Position {
    offset = clamp(offset, 0, text.length);

    const lineOffsets = getLineOffsets(text);
    let low = 0;
    let high = lineOffsets.length;
    if (high === 0) {
        return Position.create(0, offset);
    }

    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (lineOffsets[mid] > offset) {
            high = mid;
        } else {
            low = mid + 1;
        }
    }

    // low is the least x for which the line offset is larger than the current offset
    // or array.length if no line offset is larger than the current offset
    const line = low - 1;
    return Position.create(line, offset - lineOffsets[line]);
}

/**
 * Get the offset of the line and character position
 * @param position Line and character position
 * @param text The text for which the offset should be retrived
 */
export function offsetAt(position: Position, text: string): number {
    const lineOffsets = getLineOffsets(text);

    if (position.line >= lineOffsets.length) {
        return text.length;
    } else if (position.line < 0) {
        return 0;
    }

    const lineOffset = lineOffsets[position.line];
    const nextLineOffset =
        position.line + 1 < lineOffsets.length ? lineOffsets[position.line + 1] : text.length;

    return clamp(nextLineOffset, lineOffset, lineOffset + position.character);
}

function getLineOffsets(text: string) {
    const lineOffsets = [];
    let isLineStart = true;

    for (let i = 0; i < text.length; i++) {
        if (isLineStart) {
            lineOffsets.push(i);
            isLineStart = false;
        }
        const ch = text.charAt(i);
        isLineStart = ch === '\r' || ch === '\n';
        if (ch === '\r' && i + 1 < text.length && text.charAt(i + 1) === '\n') {
            i++;
        }
    }

    if (isLineStart && text.length > 0) {
        lineOffsets.push(text.length);
    }

    return lineOffsets;
}

export function isInTag(position: Position, tagInfo: TagInformation | null): boolean {
    return !!tagInfo && isInRange(Range.create(tagInfo.startPos, tagInfo.endPos), position);
}

export function getTextInRange(range: Range, text: string) {
    return text.substring(offsetAt(range.start, text), offsetAt(range.end, text));
}

export function getLineAtPosition(position: Position, text: string) {
    return text.substring(
        offsetAt({ line: position.line, character: 0 }, text),
        offsetAt({ line: position.line, character: Number.MAX_VALUE }, text),
    );
}
