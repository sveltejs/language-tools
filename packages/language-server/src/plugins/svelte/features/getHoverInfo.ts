import { Hover, Position } from 'vscode-languageserver';
import { SvelteDocument } from '../SvelteDocument';
import { documentation, SvelteTag, getLatestOpeningTag } from './SvelteTags';
import { flatten } from '../../../utils';
import { isInTag } from '../../../lib/documents';

/**
 * Get hover information for special svelte tags within moustache tags.
 */
export function getHoverInfo(svelteDoc: SvelteDocument, position: Position): Hover | null {
    const offset = svelteDoc.offsetAt(position);

    const isInStyleOrScript =
        isInTag(position, svelteDoc.style) ||
        isInTag(position, svelteDoc.script) ||
        isInTag(position, svelteDoc.moduleScript);

    const offsetStart = Math.max(offset - 10, 0);
    const charactersAroundOffset = svelteDoc
        .getText()
        // use last 10 and next 10 characters, should cover 99% of all cases
        .substr(offsetStart, 20);
    const isNoSvelteTag = !tagRegexp.test(charactersAroundOffset);

    if (isInStyleOrScript || isNoSvelteTag) {
        return null;
    }

    const tag = getTagAtOffset(svelteDoc, offsetStart, charactersAroundOffset, offset);
    if (!tag) {
        return null;
    }

    return { contents: documentation[tag] };
}

/**
 * Get the tag that is at the offset.
 */
function getTagAtOffset(
    svelteDoc: SvelteDocument,
    charactersOffset: number,
    charactersAroundOffset: string,
    offset: number
): SvelteTag | null {
    const foundTag = tagPossibilities.find((tagAndValues) =>
        tagAndValues.values.find((value) =>
            isAroundOffset(charactersOffset, charactersAroundOffset, value, offset)
        )
    );

    if (!foundTag) {
        return null;
    }
    if (foundTag.tag !== ':else') {
        return foundTag.tag;
    }
    // ':else can be part of one of each, await, if --> find out which one
    return getLatestOpeningTag(svelteDoc, offset);
}

function isAroundOffset(
    charactersOffset: number,
    charactersAroundOffset: string,
    toFind: string,
    offset: number
) {
    const match = charactersAroundOffset.match(toFind);
    if (!match || match.index === undefined) {
        return false;
    }
    const idx = match.index + charactersOffset;
    return idx <= offset && idx + toFind.length >= offset;
}

const tagPossibilities: Array<{ tag: SvelteTag | ':else'; values: string[] }> = [
    { tag: 'if' as const, values: ['#if', '/if', ':else if'] },
    // each
    { tag: 'each' as const, values: ['#each', '/each'] },
    // await
    { tag: 'await' as const, values: ['#await', '/await', ':then', ':catch'] },
    // key
    { tag: 'key' as const, values: ['#key', '/key'] },
    // @
    { tag: 'html' as const, values: ['@html'] },
    { tag: 'debug' as const, values: ['@debug'] },
    // this tag has multiple possibilities
    { tag: ':else' as const, values: [':else'] }
];

const tagRegexp = new RegExp(
    `[\\s\\S]*{\\s*(${flatten(tagPossibilities.map((p) => p.values)).join('|')})(\\s|})`
);
