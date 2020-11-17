import {
    getLanguageService,
    HTMLDocument,
    TokenType,
    ScannerState,
    Scanner
} from 'vscode-html-languageservice';
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

const createScanner = parser.createScanner as (
    input: string,
    initialOffset?: number,
    initialState?: ScannerState
) => Scanner;

/**
 * scan the text and remove any `>` that cause the tag to end short
 */
function preprocess(text: string) {
    let scanner = createScanner(text);
    let token = scanner.scan();
    let currentStartTagStart: number | null = null;

    while (token !== TokenType.EOS) {
        const offset = scanner.getTokenOffset();

        if (token === TokenType.StartTagOpen) {
            currentStartTagStart = offset;
        }

        if (
            token === TokenType.StartTagClose &&
            currentStartTagStart !== null &&
            isInsideMoustacheTag(text, currentStartTagStart, offset)
        ) {
            text = text.substring(0, offset) + ' ' + text.substring(offset + 1);
            scanner = createScanner(text, offset, ScannerState.WithinTag);
        }

        token = scanner.scan();
    }

    return text;
}
