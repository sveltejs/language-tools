/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * adopted from https://github.com/microsoft/vscode/blob/10722887b8629f90cc38ee7d90d54e8246dc895f/extensions/typescript-language-features/src/utils/previewer.ts
 */

import type ts from 'typescript';
import { isNotNullOrUndefined } from '../../utils';

function replaceLinks(text: string): string {
    return (
        text
            // Http(s) links
            .replace(
                /\{@(link|linkplain|linkcode) (https?:\/\/[^ |}]+?)(?:[| ]([^{}\n]+?))?\}/gi,
                (_, tag: string, link: string, text?: string) => {
                    switch (tag) {
                        case 'linkcode':
                            return `[\`${text ? text.trim() : link}\`](${link})`;

                        default:
                            return `[${text ? text.trim() : link}](${link})`;
                    }
                }
            )
    );
}

function processInlineTags(text: string): string {
    return replaceLinks(text);
}

function getTagBodyText(tsModule: typeof ts, tag: ts.JSDocTagInfo): string | undefined {
    if (!tag.text) {
        return undefined;
    }

    // Convert to markdown code block if it is not already one
    function makeCodeblock(text: string): string {
        if (text.match(/^\s*[~`]{3}/g)) {
            return text;
        }
        return '```\n' + text + '\n```';
    }

    function makeExampleTag(text: string) {
        // check for caption tags, fix for https://github.com/microsoft/vscode/issues/79704
        const captionTagMatches = text.match(/<caption>(.*?)<\/caption>\s*(\r\n|\n)/);
        if (captionTagMatches && captionTagMatches.index === 0) {
            return (
                captionTagMatches[1] +
                '\n\n' +
                makeCodeblock(text.substr(captionTagMatches[0].length))
            );
        } else {
            return makeCodeblock(text);
        }
    }

    function makeEmailTag(text: string) {
        // fix obsucated email address, https://github.com/microsoft/vscode/issues/80898
        const emailMatch = text.match(/(.+)\s<([-.\w]+@[-.\w]+)>/);

        if (emailMatch === null) {
            return text;
        } else {
            return `${emailMatch[1]} ${emailMatch[2]}`;
        }
    }

    switch (tag.name) {
        case 'example':
            return makeExampleTag(tsModule.displayPartsToString(tag.text));
        case 'author':
            return makeEmailTag(tsModule.displayPartsToString(tag.text));
        case 'default':
            return makeCodeblock(tsModule.displayPartsToString(tag.text));
    }

    return processInlineTags(tsModule.displayPartsToString(tag.text));
}

export function getTagDocumentation(tsModule: typeof ts, tag: ts.JSDocTagInfo): string | undefined {
    function getWithType() {
        const body = (tsModule.displayPartsToString(tag.text) || '').split(/^(\S+)\s*-?\s*/);
        if (body?.length === 3) {
            const param = body[1];
            const doc = body[2];
            const label = `*@${tag.name}* \`${param}\``;
            if (!doc) {
                return label;
            }
            return (
                label +
                (doc.match(/\r\n|\n/g)
                    ? '  \n' + processInlineTags(doc)
                    : ` — ${processInlineTags(doc)}`)
            );
        }
    }

    switch (tag.name) {
        case 'augments':
        case 'extends':
        case 'param':
        case 'template':
            return getWithType();
    }

    // Generic tag
    const label = `*@${tag.name}*`;
    const text = getTagBodyText(tsModule, tag);
    if (!text) {
        return label;
    }
    return label + (text.match(/\r\n|\n/g) ? '  \n' + text : ` — ${text}`);
}

export function plain(tsModule: typeof ts, parts: ts.SymbolDisplayPart[] | string): string {
    return processInlineTags(
        typeof parts === 'string' ? parts : tsModule.displayPartsToString(parts)
    );
}

export function getMarkdownDocumentation(
    tsModule: typeof ts,
    documentation: ts.SymbolDisplayPart[] | undefined,
    tags: ts.JSDocTagInfo[] | undefined
) {
    let result: Array<string | undefined> = [];
    if (documentation) {
        result.push(plain(tsModule, documentation));
    }

    if (tags) {
        result = result.concat(tags.map((tag) => getTagDocumentation(tsModule, tag)));
    }

    return result.filter(isNotNullOrUndefined).join('\n\n');
}
