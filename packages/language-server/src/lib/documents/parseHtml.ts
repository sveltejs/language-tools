import {
    getLanguageService,
    HTMLDocument,
    TokenType,
    ScannerState,
    Scanner,
    Node,
    Position
} from 'vscode-html-languageservice';
import { Document } from './Document';
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
 * scan the text and remove any `>` or `<` that cause the tag to end short,
 */
function preprocess(text: string) {
    let scanner = createScanner(text);
    let token = scanner.scan();
    let currentStartTagStart: number | null = null;
    let moustacheCheckStart = 0;
    let moustacheCheckEnd = 0;
    let lastToken = token;

    while (token !== TokenType.EOS) {
        const offset = scanner.getTokenOffset();
        let blanked = false;

        switch (token) {
            case TokenType.StartTagOpen:
                if (shouldBlankStartOrEndTagLike(offset)) {
                    blankStartOrEndTagLike(offset);
                    blanked = true;
                } else {
                    currentStartTagStart = offset;
                }
                break;

            case TokenType.StartTagClose:
                if (shouldBlankStartOrEndTagLike(offset)) {
                    blankStartOrEndTagLike(offset);
                    blanked = true;
                } else {
                    currentStartTagStart = null;
                }
                break;

            case TokenType.StartTagSelfClose:
                currentStartTagStart = null;
                break;

            // <Foo checked={a < 1}>
            // https://github.com/microsoft/vscode-html-languageservice/blob/71806ef57be07e1068ee40900ef8b0899c80e68a/src/parser/htmlScanner.ts#L327
            case TokenType.Unknown:
                if (
                    scanner.getScannerState() === ScannerState.WithinTag &&
                    scanner.getTokenText() === '<' &&
                    shouldBlankStartOrEndTagLike(offset)
                ) {
                    blankStartOrEndTagLike(offset);
                    blanked = true;
                }
                break;

            case TokenType.Content: {
                moustacheCheckEnd = scanner.getTokenEnd();
                if (token !== lastToken) {
                    moustacheCheckStart = offset;
                }
                break;
            }
        }

        // blanked, so the token type is invalid
        if (!blanked) {
            lastToken = token;
        }
        token = scanner.scan();
    }

    return text;

    function shouldBlankStartOrEndTagLike(offset: number) {
        if (currentStartTagStart != null) {
            return isInsideMoustacheTag(text, currentStartTagStart, offset);
        }

        const index = text
            .substring(moustacheCheckStart, moustacheCheckEnd)
            .lastIndexOf('{', offset);

        const lastMustacheTagStart = index === -1 ? null : moustacheCheckStart + index;
        if (lastMustacheTagStart == null) {
            return false;
        }

        return isInsideMoustacheTag(
            text.substring(lastMustacheTagStart),
            null,
            offset - lastMustacheTagStart
        );
    }

    function blankStartOrEndTagLike(offset: number) {
        text = text.substring(0, offset) + ' ' + text.substring(offset + 1);
        scanner = createScanner(
            text,
            offset,
            currentStartTagStart != null ? ScannerState.WithinTag : ScannerState.WithinContent
        );
    }
}

export interface AttributeContext {
    name: string;
    inValue: boolean;
    elementTag: Node;
    valueRange?: [number, number];
}

export function getAttributeContextAtPosition(
    document: Document,
    position: Position
): AttributeContext | null {
    const offset = document.offsetAt(position);
    const { html } = document;
    const tag = html.findNodeAt(offset);

    if (!inStartTag(offset, tag) || !tag.attributes) {
        return null;
    }

    const text = document.getText();
    const beforeStartTagEnd =
        text.substring(0, tag.start) + preprocess(text.substring(tag.start, tag.startTagEnd));

    const scanner = createScanner(beforeStartTagEnd, tag.start);

    let token = scanner.scan();
    let currentAttributeName: string | undefined;
    const inTokenRange = () =>
        scanner.getTokenOffset() <= offset && offset <= scanner.getTokenEnd();
    while (token != TokenType.EOS) {
        // adopted from https://github.com/microsoft/vscode-html-languageservice/blob/2f7ae4df298ac2c299a40e9024d118f4a9dc0c68/src/services/htmlCompletion.ts#L402
        if (token === TokenType.AttributeName) {
            currentAttributeName = scanner.getTokenText();

            if (inTokenRange()) {
                return {
                    elementTag: tag,
                    name: currentAttributeName,
                    inValue: false
                };
            }
        } else if (token === TokenType.DelimiterAssign) {
            if (scanner.getTokenEnd() === offset && currentAttributeName) {
                const nextToken = scanner.scan();

                return {
                    elementTag: tag,
                    name: currentAttributeName,
                    inValue: true,
                    valueRange: [
                        offset,
                        nextToken === TokenType.AttributeValue ? scanner.getTokenEnd() : offset
                    ]
                };
            }
        } else if (token === TokenType.AttributeValue) {
            if (inTokenRange() && currentAttributeName) {
                let start = scanner.getTokenOffset();
                let end = scanner.getTokenEnd();
                const char = text[start];

                if (char === '"' || char === "'") {
                    start++;
                    end--;
                }

                return {
                    elementTag: tag,
                    name: currentAttributeName,
                    inValue: true,
                    valueRange: [start, end]
                };
            }
            currentAttributeName = undefined;
        }
        token = scanner.scan();
    }

    return null;
}

function inStartTag(offset: number, node: Node) {
    return offset > node.start && node.startTagEnd != undefined && offset < node.startTagEnd;
}
