import { getLanguageService, HTMLDocument, TokenType } from 'vscode-html-languageservice';
import { isInsideMoustacheTag } from './utils';

const parser = getLanguageService();

/**
 * Parses text as HTML
 */
export function parseHtml(text: string): HTMLDocument {
    const preprocessed = preprocess(text);

    // We can safely only set getText because only this is used for parsing
    const parsedDoc = parser.parseHTMLDocument(<any>{ getText: () => preprocessed });

    return parsedDoc;
}

const OPEN_TAG_SELF_CLOSE = '/>';
const blankRegex = /(=>|>=)/g;

function preprocess(text: string) {
    const scanner = parser.createScanner(text);
    let result = text;
    let token = scanner.scan();
    let currentStartTagStart: number | null = null;
    let currentStartTagEndShort = false;

    while (token !== TokenType.EOS) {
        const offset = scanner.getTokenOffset();

        if (token === TokenType.StartTagOpen) {
            removeEnd(offset);
            currentStartTagEndShort = false;
            currentStartTagStart = offset;
        }

        if (token === TokenType.StartTagClose) {
            if (
                currentStartTagStart !== null &&
                isInsideMoustacheTag(text, currentStartTagStart, offset)
            ) {
                currentStartTagEndShort = true;
            }
        }

        if (token === TokenType.EndTagOpen) {
            removeEnd(offset);
            currentStartTagStart = null;
            currentStartTagEndShort = false;
        }

        token = scanner.scan();
    }

    return result;

    function removeEnd(offset: number) {
        if (currentStartTagStart === null) {
            return;
        }

        const contentWithin = text.substring(currentStartTagStart, offset);
        if (currentStartTagEndShort && contentWithin.includes(OPEN_TAG_SELF_CLOSE)) {
            result =
                result.substring(0, currentStartTagStart) +
                contentWithin.replace(blankRegex, '  ') +
                result.substring(offset);
        }
    }
}
