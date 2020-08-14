import { clamp, isInRange, regexLastIndexOf } from '../../utils';
import { Position, Range } from 'vscode-languageserver';
import { Node, getLanguageService } from 'vscode-html-languageservice';
import * as path from 'path';

export interface TagInformation {
    content: string;
    attributes: Record<string, string>;
    start: number;
    end: number;
    startPos: Position;
    endPos: Position;
    container: { start: number; end: number };
}

function parseAttributes(
    rawAttrs: Record<string, string | null> | undefined,
): Record<string, string> {
    const attrs: Record<string, string> = {};
    if (!rawAttrs) {
        return attrs;
    }

    Object.keys(rawAttrs).forEach((attrName) => {
        const attrValue = rawAttrs[attrName];
        attrs[attrName] = attrValue === null ? attrName : removeOuterQuotes(attrValue);
    });
    return attrs;

    function removeOuterQuotes(attrValue: string) {
        if (
            (attrValue.startsWith('"') && attrValue.endsWith('"')) ||
            (attrValue.startsWith("'") && attrValue.endsWith("'"))
        ) {
            return attrValue.slice(1, attrValue.length - 1);
        }
        return attrValue;
    }
}

const parser = getLanguageService();
function parseHtml(text: string) {
    // We can safely only set getText because only this is used for parsing
    return parser.parseHTMLDocument(<any>{ getText: () => text });
}

const regexIf = new RegExp('{#if\\s.*?}', 'gms');
const regexIfElseIf = new RegExp('{:else if\\s.*?}', 'gms');
const regexIfEnd = new RegExp('{/if}', 'gms');
const regexEach = new RegExp('{#each\\s.*?}', 'gms');
const regexEachEnd = new RegExp('{/each}', 'gms');
const regexAwait = new RegExp('{#await\\s.*?}', 'gms');
const regexAwaitEnd = new RegExp('{/await}', 'gms');
const regexHtml = new RegExp('{@html\\s.*?', 'gms');

/**
 * if-blocks can contain the `<` operator, which mistakingly is
 * parsed as a "open tag" character by the html parser.
 * To prevent this, just replace the whole content inside the if with whitespace.
 */
function blankIfBlocks(text: string): string {
    return text
        .replace(regexIf, (substr) => {
            return '{#if' + substr.replace(/[^\n]/g, ' ').substring(4, substr.length - 1) + '}';
        })
        .replace(regexIfElseIf, (substr) => {
            return (
                '{:else if' + substr.replace(/[^\n]/g, ' ').substring(9, substr.length - 1) + '}'
            );
        });
}

/**
 * Extracts a tag (style or script) from the given text
 * and returns its start, end and the attributes on that tag.
 *
 * @param source text content to extract tag from
 * @param tag the tag to extract
 */
function extractTags(text: string, tag: 'script' | 'style'): TagInformation[] {
    text = blankIfBlocks(text);
    const rootNodes = parseHtml(text).roots;
    const matchedNodes = rootNodes
        .filter((node) => node.tag === tag)
        .filter((tag) => {
            return isNotInsideControlFlowTag(tag) && isNotInsideHtmlTag(tag);
        });
    return matchedNodes.map(transformToTagInfo);

    /**
     * For every match AFTER the tag do a search for `{/X`.
     * If that is BEFORE `{#X`, we are inside a moustache tag.
     */
    function isNotInsideControlFlowTag(tag: Node) {
        const nodes = rootNodes.slice(rootNodes.indexOf(tag));
        const rootContentAfterTag = nodes
            .map((node, idx) => {
                return text.substring(node.end, nodes[idx + 1]?.start);
            })
            .join('');

        return ![
            [regexIf, regexIfEnd],
            [regexEach, regexEachEnd],
            [regexAwait, regexAwaitEnd],
        ].some((pair) => {
            pair[0].lastIndex = 0;
            pair[1].lastIndex = 0;
            const start = pair[0].exec(rootContentAfterTag);
            const end = pair[1].exec(rootContentAfterTag);
            return (end?.index ?? text.length) < (start?.index ?? text.length);
        });
    }

    /**
     * For every match BEFORE the tag do a search for `{@html`.
     * If that is BEFORE `}`, we are inside a moustache tag.
     */
    function isNotInsideHtmlTag(tag: Node) {
        const nodes = rootNodes.slice(0, rootNodes.indexOf(tag));
        const rootContentBeforeTag = [{ start: 0, end: 0 }, ...nodes]
            .map((node, idx) => {
                return text.substring(node.end, nodes[idx]?.start);
            })
            .join('');

        return !(
            regexLastIndexOf(rootContentBeforeTag, regexHtml) >
            rootContentBeforeTag.lastIndexOf('}')
        );
    }

    function transformToTagInfo(matchedNode: Node) {
        const start = matchedNode.startTagEnd ?? matchedNode.start;
        const end = matchedNode.endTagStart ?? matchedNode.end;
        const startPos = positionAt(start, text);
        const endPos = positionAt(end, text);
        const container = {
            start: matchedNode.start,
            end: matchedNode.end,
        };
        const content = text.substring(start, end);

        return {
            content,
            attributes: parseAttributes(matchedNode.attributes),
            start,
            end,
            startPos,
            endPos,
            container,
        };
    }
}

export function extractScriptTags(
    source: string,
): { script?: TagInformation; moduleScript?: TagInformation } | null {
    const scripts = extractTags(source, 'script');
    if (!scripts.length) {
        return null;
    }

    const script = scripts.find((s) => s.attributes['context'] !== 'module');
    const moduleScript = scripts.find((s) => s.attributes['context'] === 'module');
    return { script, moduleScript };
}

export function extractStyleTag(source: string): TagInformation | null {
    const styles = extractTags(source, 'style');
    if (!styles.length) {
        return null;
    }

    // There can only be one style tag
    return styles[0];
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

export function isInTag(
    position: Position,
    tagInfo: TagInformation | null,
): tagInfo is TagInformation {
    return !!tagInfo && isInRange(Range.create(tagInfo.startPos, tagInfo.endPos), position);
}

export function isRangeInTag(
    range: Range,
    tagInfo: TagInformation | null,
): tagInfo is TagInformation {
    return isInTag(range.start, tagInfo) && isInTag(range.end, tagInfo);
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

/**
 * Updates a relative import
 *
 * @param oldPath Old absolute path
 * @param newPath New absolute path
 * @param relativeImportPath Import relative to the old path
 */
export function updateRelativeImport(oldPath: string, newPath: string, relativeImportPath: string) {
    let newImportPath = path
        .join(path.relative(newPath, oldPath), relativeImportPath)
        .replace(/\\/g, '/');
    if (!newImportPath.startsWith('.')) {
        newImportPath = './' + newImportPath;
    }
    return newImportPath;
}
