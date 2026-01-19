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
    let lastToken = token;
    let unclosedBlockOrMoustache: BracketCheckState | null = null;

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
                    unclosedBlockOrMoustache = null;
                    moustacheCheckStart = offset;
                }
                break;

            case TokenType.StartTagClose:
                if (shouldBlankStartOrEndTagLike(offset)) {
                    blankStartOrEndTagLike(offset);
                    blanked = true;
                } else {
                    currentStartTagStart = null;
                    unclosedBlockOrMoustache = null;
                    moustacheCheckStart = offset;
                }
                break;

            case TokenType.StartTagSelfClose:
                currentStartTagStart = null;
                unclosedBlockOrMoustache = null;
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
                if (token !== lastToken) {
                    moustacheCheckStart = offset;
                }
                break;
            }

            case TokenType.EndTagOpen:
                unclosedBlockOrMoustache = null;
                break;
        }

        // blanked, so the token type is invalid
        if (!blanked) {
            lastToken = token;
        }
        token = scanner.scan();
    }

    return text;

    function shouldBlankStartOrEndTagLike(offset: number) {
        const unclosed = matchUnclosedMoustacheTag(
            text,
            moustacheCheckStart,
            offset,
            unclosedBlockOrMoustache
        );
        moustacheCheckStart = offset;
        unclosedBlockOrMoustache = unclosed;
        return unclosed !== null;
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

const backtickCode = '`'.charCodeAt(0);
const bracketStartCode = '{'.charCodeAt(0);
const bracketEndCode = '}'.charCodeAt(0);

interface BracketCheckState {
    depth: number;
    stringChar: number | null;
}

/**
 * Checks whether given position is inside a moustache tag (which includes control flow tags)
 * using a simple bracket matching algorithm.
 */
function matchUnclosedMoustacheTag(
    html: string,
    start: number,
    position: number,
    lastState: BracketCheckState | null = null
): BracketCheckState | null {
    let depth = lastState?.depth ?? 0;
    let stringChar: number | null = lastState?.stringChar ?? null;

    let templateStack: number[] = [];
    for (let index = start; index < position; index++) {
        const char = html.charCodeAt(index);
        switch (char) {
            case bracketStartCode:
                if (stringChar === null) {
                    depth++;
                }
                break;
            case bracketEndCode:
                if (stringChar === null && depth > 0) {
                    depth--;
                }
                if (templateStack.length > 0 && depth === 0) {
                    depth = templateStack.pop() || 0;
                    stringChar = backtickCode;
                }
                break;
            case 39: // '
            case 34: // "
                if (stringChar === char) {
                    stringChar = null;
                } else if (stringChar === null) {
                    stringChar = char;
                }
                break;

            case backtickCode:
                if (stringChar === backtickCode) {
                    stringChar = null;
                } else if (stringChar === null) {
                    stringChar = backtickCode;
                }
                break;
            case 92: // \
                if (stringChar !== null) {
                    // skip next character
                    index++;
                }
                break;
            case 36: // $
                if (
                    stringChar === backtickCode &&
                    html.charCodeAt(index + 1) === bracketStartCode
                ) {
                    templateStack.push(depth);
                    depth = 0;
                    stringChar = null;
                    index++;
                }
                break;
        }
    }

    return depth > 0 ? { depth, stringChar } : null;
}

export function isInsideMoustacheTag(html: string, tagStart: number, position: number): boolean {
    const unclosed = matchUnclosedMoustacheTag(html, tagStart, position);
    return unclosed !== null;
}
