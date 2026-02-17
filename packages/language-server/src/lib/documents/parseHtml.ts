import {
    HTMLDocument,
    Node,
    Position,
    ScannerState,
    TokenType,
    getDefaultHTMLDataProvider,
    getLanguageService
} from 'vscode-html-languageservice';
import { Document } from './Document';
import { scanMatchingBraces } from './utils';

const voidElements = new Set(
    getDefaultHTMLDataProvider()
        .provideTags()
        .filter((tag) => tag.void)
        .map((tag) => tag.name)
);
const createScanner = getLanguageService()
    .createScanner as typeof import('vscode-html-languageservice/lib/esm/parser/htmlScanner').createScanner;

const braceStartCode = '{'.charCodeAt(0);
const singleQuoteCode = "'".charCodeAt(0);
const doubleQuoteCode = '"'.charCodeAt(0);

/**
 * adopted from https://github.com/microsoft/vscode-html-languageservice/blob/10daf45dc16b4f4228987cf7cddf3a7dbbdc7570/src/parser/htmlParser.ts
 * differences:
 *
 * 1. parse expression tag in Whitespace state
 * 2. parse attribute with interpolation in AttributeValue state
 * 3. detect svelte blocks/tags in Content state
 */
export function parseHtml(text: string): HTMLDocument {
    let scanner = createScanner(text, undefined, undefined, true);

    const htmlDocument = new HTMLNode(0, text.length, [], undefined);
    let curr = htmlDocument;
    let endTagStart: number = -1;
    let endTagName: string | undefined = undefined;
    let pendingAttribute: string | null = null;
    let token = scanner.scan();

    while (token !== TokenType.EOS) {
        switch (token) {
            case TokenType.StartTagOpen:
                const child = new HTMLNode(scanner.getTokenOffset(), text.length, [], curr);
                curr.children.push(child);
                curr = child;
                break;
            case TokenType.StartTag:
                curr.tag = scanner.getTokenText();
                break;
            case TokenType.StartTagClose:
                if (curr.parent) {
                    curr.end = scanner.getTokenEnd(); // might be later set to end tag position
                    if (scanner.getTokenLength()) {
                        curr.startTagEnd = scanner.getTokenEnd();
                        if (curr.tag && voidElements.has(curr.tag)) {
                            curr.closed = true;
                            curr = curr.parent;
                        }
                    } else {
                        // pseudo close token from an incomplete start tag
                        curr = curr.parent;
                    }
                }
                break;
            case TokenType.StartTagSelfClose:
                if (curr.parent) {
                    curr.closed = true;
                    curr.end = scanner.getTokenEnd();
                    curr.startTagEnd = scanner.getTokenEnd();
                    curr = curr.parent;
                }
                break;
            case TokenType.EndTagOpen:
                endTagStart = scanner.getTokenOffset();
                endTagName = undefined;
                break;
            case TokenType.EndTag:
                endTagName = scanner.getTokenText().toLowerCase();
                break;
            case TokenType.EndTagClose:
                let node = curr;
                // see if we can find a matching tag
                while (!node.isSameTag(endTagName) && node.parent) {
                    node = node.parent;
                }
                if (node.parent) {
                    while (curr !== node) {
                        curr.end = endTagStart;
                        curr.closed = false;
                        curr = curr.parent!;
                    }
                    curr.closed = true;
                    curr.endTagStart = endTagStart;
                    curr.end = scanner.getTokenEnd();
                    curr = curr.parent!;
                }
                break;
            case TokenType.AttributeName: {
                pendingAttribute = scanner.getTokenText();
                let attributes = curr.attributes;
                if (!attributes) {
                    curr.attributes = attributes = {};
                }
                attributes[pendingAttribute] = null;
                break;
            }

            case TokenType.DelimiterAssign: {
                const afterAssign = scanner.getTokenEnd();
                if (text.charCodeAt(afterAssign) === braceStartCode) {
                    const result = scanMatchingBraces(text, afterAssign);
                    restartScannerAt(result.endOffset, ScannerState.WithinTag);
                    finishAttribute(afterAssign, result.endOffset);
                }
                break;
            }
            case TokenType.Whitespace: {
                const afterWhitespace = scanner.getTokenEnd();
                if (text.charCodeAt(afterWhitespace) === braceStartCode) {
                    // <div a = {...}
                    if (scanner.getScannerState() === ScannerState.BeforeAttributeValue) {
                        const result = scanMatchingBraces(text, afterWhitespace);
                        restartScannerAt(result.endOffset, ScannerState.WithinTag);
                        finishAttribute(afterWhitespace, result.endOffset);
                    } else {
                        // spread or attribute short-hand
                        parseSpreadOrShorthandAttribute(afterWhitespace);
                    }
                }
                break;
            }
            case TokenType.AttributeValue:
                parseAttributeValue();
                break;

            case TokenType.Content: {
                const expressionEnd = skipExpressionInCurrentRange();
                if (expressionEnd > scanner.getTokenEnd()) {
                    restartScannerAt(expressionEnd, ScannerState.WithinContent);
                }
                break;
            }
        }

        token = scanner.scan();
    }
    while (curr.parent) {
        curr.end = text.length;
        curr.closed = false;
        curr = curr.parent;
    }
    return {
        roots: htmlDocument.children,
        findNodeBefore: htmlDocument.findNodeBefore.bind(htmlDocument),
        findNodeAt: htmlDocument.findNodeAt.bind(htmlDocument)
    };

    function skipExpressionInCurrentRange() {
        const start = scanner.getTokenOffset();
        const end = scanner.getTokenEnd();
        let index = start;
        while (index < end) {
            if (text.charCodeAt(index) !== braceStartCode) {
                index++;
                continue;
            }
            const matchResult = scanMatchingBraces(text, index);
            index = matchResult.endOffset;
        }

        return Math.max(index, end);
    }

    function restartScannerAt(offset: number, scannerState: ScannerState) {
        if (offset <= scanner.getTokenEnd()) {
            return;
        }
        scanner = createScanner(text, offset, scannerState, /* emitPseudoCloseTags*/ true);
    }

    function finishAttribute(start: number, end: number) {
        if (!pendingAttribute || !curr.attributes) {
            return;
        }

        curr.attributes[pendingAttribute] = text.substring(start, end);
        pendingAttribute = null;
    }

    function parseSpreadOrShorthandAttribute(startOffset: number) {
        const scanResult = scanMatchingBraces(text, startOffset);
        const end = scanResult.endOffset;
        restartScannerAt(end, ScannerState.WithinTag);
        const expressionStart = startOffset + 1;
        const expressionEnd = end - 1;
        const expression = text.substring(expressionStart, expressionEnd).trim();
        if (text.substring(expressionStart).startsWith('...')) {
            return;
        }

        curr.attributes ??= {};
        curr.attributes[expression] = text.substring(startOffset, end);
    }

    function parseAttributeValue() {
        const quote = text.charCodeAt(scanner.getTokenOffset());
        // <a href=a >
        if (!isQuote(quote)) {
            finishAttribute(scanner.getTokenOffset(), scanner.getTokenEnd());
            return;
        }
        const start = scanner.getTokenOffset();
        const tokenEnd = scanner.getTokenEnd();
        let expressionTagEnd = skipExpressionInCurrentRange();
        if (expressionTagEnd > tokenEnd) {
            const indexOfQuote = text.indexOf(String.fromCharCode(quote), expressionTagEnd);
            expressionTagEnd = indexOfQuote !== -1 ? indexOfQuote + 1 : text.length;
            restartScannerAt(expressionTagEnd, ScannerState.WithinTag);
        }
        finishAttribute(start, expressionTagEnd);
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
    const beforeStartTagEnd = text.substring(0, tag.startTagEnd);

    let scanner = createScanner(beforeStartTagEnd, tag.start);

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
            const afterAssign = scanner.getTokenEnd();
            if (afterAssign === offset && currentAttributeName) {
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
            if (text.charCodeAt(afterAssign) === braceStartCode) {
                const scanResult = scanMatchingBraces(text, afterAssign);
                restartScannerAt(scanResult.endOffset, ScannerState.WithinTag);
            }
        } else if (token === TokenType.AttributeValue) {
            if (inTokenRange() && currentAttributeName) {
                let start = scanner.getTokenOffset();
                let end = scanner.getTokenEnd();

                if (isQuote(text.charCodeAt(start))) {
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
        } else if (token === TokenType.Whitespace) {
            const afterWhitespace = scanner.getTokenEnd();
            if (text.charCodeAt(afterWhitespace) === braceStartCode) {
                // <div a = {...}
                if (scanner.getScannerState() === ScannerState.BeforeAttributeValue) {
                    const scanResult = scanMatchingBraces(text, afterWhitespace);
                    restartScannerAt(scanResult.endOffset, ScannerState.WithinTag);
                } else {
                    // spread or attribute short-hand
                    parseSpreadOrShorthandAttribute(afterWhitespace);
                }
            }
        }
        token = scanner.scan();

        function parseSpreadOrShorthandAttribute(startOffset: number) {
            const scanResult = scanMatchingBraces(text, startOffset);
            const end = scanResult.endOffset;
            restartScannerAt(end, ScannerState.WithinTag);
        }
    }

    return null;

    function restartScannerAt(offset: number, scannerState: ScannerState) {
        if (offset <= scanner.getTokenEnd()) {
            return;
        }

        scanner = createScanner(beforeStartTagEnd, offset, scannerState);
    }
}

function isQuote(charCode: number) {
    return charCode === singleQuoteCode || charCode === doubleQuoteCode;
}

function inStartTag(offset: number, node: Node) {
    return offset > node.start && node.startTagEnd != undefined && offset < node.startTagEnd;
}

/**
 * adopted from https://github.com/microsoft/vscode-html-languageservice/blob/10daf45dc16b4f4228987cf7cddf3a7dbbdc7570/src/parser/htmlParser.ts
 */
export class HTMLNode implements Node {
    tag: string | undefined;
    closed: boolean = false;
    startTagEnd: number | undefined;
    endTagStart: number | undefined;
    attributes?: { [name: string]: string | null } | undefined;

    get attributeNames(): string[] {
        return this.attributes ? Object.keys(this.attributes) : [];
    }

    constructor(
        public start: number,
        public end: number,
        public children: HTMLNode[],
        public parent?: HTMLNode
    ) {}

    isSameTag(tagInLowerCase: string | undefined) {
        if (this.tag === undefined) {
            return tagInLowerCase === undefined;
        } else {
            return (
                tagInLowerCase !== undefined &&
                this.tag.length === tagInLowerCase.length &&
                this.tag.toLowerCase() === tagInLowerCase
            );
        }
    }

    public get firstChild(): Node | undefined {
        return this.children[0];
    }
    public get lastChild(): Node | undefined {
        return this.children.length ? this.children[this.children.length - 1] : void 0;
    }

    public findNodeBefore(offset: number): Node {
        const idx = HTMLNode.findFirst(this.children, (c) => offset <= c.start) - 1;
        if (idx >= 0) {
            const child = this.children[idx];
            if (offset > child.start) {
                if (offset < child.end) {
                    return child.findNodeBefore(offset);
                }
                const lastChild = child.lastChild;
                if (lastChild && lastChild.end === child.end) {
                    return child.findNodeBefore(offset);
                }
                return child;
            }
        }
        return this;
    }

    public findNodeAt(offset: number): Node {
        const idx = HTMLNode.findFirst(this.children, (c) => offset <= c.start) - 1;
        if (idx >= 0) {
            const child = this.children[idx];
            if (offset > child.start && offset <= child.end) {
                return child.findNodeAt(offset);
            }
        }
        return this;
    }

    private static findFirst<T>(array: T[], p: (t: T) => boolean): number {
        let low = 0,
            high = array.length;
        if (high === 0) {
            return 0; // no children
        }
        while (low < high) {
            let mid = Math.floor((low + high) / 2);
            if (p(array[mid])) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return low;
    }
}
