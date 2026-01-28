import {
    HTMLDocument,
    TokenType,
    ScannerState,
    Node,
    Position,
    getDefaultHTMLDataProvider
} from 'vscode-html-languageservice';
import { createScanner } from 'vscode-html-languageservice/lib/umd/parser/htmlScanner';
import { Document } from './Document';
import { scanMatchingBraces } from './utils';

const voidElements = new Set(
    getDefaultHTMLDataProvider()
        .provideTags()
        .filter((tag) => tag.void)
        .map((tag) => tag.name)
);

const braceStartCode = '{'.charCodeAt(0);
const singleQuoteCode = "'".charCodeAt(0);
const doubleQuoteCode = '"'.charCodeAt(0);

/**
 * adopted from https://github.com/microsoft/vscode-html-languageservice/blob/10daf45dc16b4f4228987cf7cddf3a7dbbdc7570/src/parser/htmlParser.ts
 */
export function parseHtml(text: string): HTMLDocument {
    let scanner = createScanner(text, undefined, undefined, true);

    const htmlDocument = new HTMLNode(0, text.length, [], undefined);
    let curr = htmlDocument;
    let endTagStart: number = -1;
    let endTagName: string | undefined = undefined;
    let pendingAttribute: Attribute | null = null;
    let token = scanner.scan();
    let currentStartTag: HTMLNode | null = null;

    while (token !== TokenType.EOS) {
        switch (token) {
            case TokenType.StartTagOpen:
                const child = new HTMLNode(scanner.getTokenOffset(), text.length, [], curr);
                curr.children.push(child);
                curr = child;
                currentStartTag = curr;
                break;
            case TokenType.StartTag:
                curr.tag = scanner.getTokenText();
                break;
            case TokenType.StartTagClose:
                if (curr.parent) {
                    curr.end = scanner.getTokenEnd(); // might be later set to end tag position
                    currentStartTag = null;
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
                    currentStartTag = null;
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
                const offset = scanner.getTokenOffset();
                if (text.charCodeAt(offset) === braceStartCode) {
                    scanMatchingBraces(text, offset);
                }

                pendingAttribute = {
                    name: scanner.getTokenText(),
                    valueFull: null,
                    start: offset
                };
                let attributes = curr.attributeList;
                if (!attributes) {
                    curr.attributeList = attributes = [];
                }
                attributes.push(pendingAttribute);
                break;
            }

            case TokenType.DelimiterAssign: {
                const afterBrace = scanner.getTokenEnd();
                if (text.charCodeAt(afterBrace) === braceStartCode) {
                    const valueEnd = skipTemplateExpression(afterBrace);
                    finishAttribute(afterBrace, valueEnd);
                }
                break;
            }
            case TokenType.Whitespace: {
                const afterWhitespace = scanner.getTokenEnd();
                // spread or attribute short-hand
                if (text.charCodeAt(afterWhitespace) === braceStartCode) {
                    parseSpreadOrShorthandAttribute(afterWhitespace);
                }
                break;
            }
            case TokenType.AttributeValue: {
                const start = scanner.getTokenOffset();
                const expressionTagEnd = skipExpressionInCurrentRange();
                finishAttribute(start, expressionTagEnd);
                break;
            }

            case TokenType.Content: {
                skipExpressionInCurrentRange();
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

    function skipTemplateExpression(startOffset: number): number {
        const result = scanMatchingBraces(text, startOffset);
        restartScannerAt(result.endOffset);
        return result.endOffset;
    }

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
        if (index > end) {
            restartScannerAt(index);
            return index;
        }

        return end;
    }

    function restartScannerAt(offset: number) {
        if (offset === scanner.getTokenEnd()) {
            return;
        }
        scanner = createScanner(
            text,
            offset,
            currentStartTag != null ? ScannerState.WithinTag : ScannerState.WithinContent,
            /* emitPseudoCloseTags*/ true
        );
    }

    function finishAttribute(start: number, end: number) {
        if (!pendingAttribute) {
            return;
        }
        pendingAttribute.valueFullRange = [start, end];
        pendingAttribute.valueFull = text.substring(start, end);
        pendingAttribute = null;
    }

    function parseSpreadOrShorthandAttribute(startOffset: number) {
        const end = skipTemplateExpression(startOffset);
        const expressionStart = startOffset + 1;
        const expressionEnd = end - 1;
        const expression = text.substring(expressionStart, expressionEnd).trim();
        if (text.substring(expressionStart).startsWith('...')) {
            return;
        }
        curr.attributeList ??= [];
        curr.attributeList.push({
            name: expression,
            start: startOffset,
            valueFullRange: [startOffset, end],
            valueFull: text.substring(startOffset, end)
        });
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
    const text = document.getText();

    if (
        !inStartTag(offset, tag) ||
        !tag.attributes ||
        !(tag instanceof HTMLNode && tag.attributeList)
    ) {
        return null;
    }

    for (const attr of tag.attributeList) {
        if (offset < attr.start) {
            continue;
        }
        const nameEnd = attr.start + attr.name.length;
        if (offset <= nameEnd) {
            return {
                name: attr.name,
                inValue: false,
                elementTag: tag
            };
        }
        if (attr.valueFullRange) {
            const [valueStart, valueEnd] = attr.valueFullRange;
            if (offset >= valueStart && offset <= valueEnd) {
                let [start, end] = attr.valueFullRange;
                if (isQuote(text.charCodeAt(valueStart))) {
                    start++;
                }
                if (isQuote(text.charCodeAt(valueEnd - 1))) {
                    end--;
                }
                return {
                    name: attr.name,
                    inValue: true,
                    elementTag: tag,
                    valueRange: [start, end]
                };
            }
        }
    }

    return null;
}

function isQuote(charCode: number) {
    return (
        charCode === singleQuoteCode || charCode === doubleQuoteCode
    );
}

function inStartTag(offset: number, node: Node) {
    return offset > node.start && node.startTagEnd != undefined && offset < node.startTagEnd;
}

interface Attribute {
    name: string;
    valueFullRange?: [number, number];
    valueFull: string | null;
    start: number;
}

/**
 * adopted from https://github.com/microsoft/vscode-html-languageservice/blob/10daf45dc16b4f4228987cf7cddf3a7dbbdc7570/src/parser/htmlParser.ts
 */
export class HTMLNode implements Node {
    tag: string | undefined;
    closed: boolean = false;
    startTagEnd: number | undefined;
    endTagStart: number | undefined;
    attributeList: Attribute[] | undefined;
    private attributesCache: { [name: string]: string | null } | undefined;

    get attributes(): { [name: string]: string | null } | undefined {
        if (this.attributesCache) {
            return this.attributesCache;
        }
        if (!this.attributeList) {
            return undefined;
        }
        const attrs: { [name: string]: string | null } = {};
        for (const attr of this.attributeList) {
            attrs[attr.name] = attr.valueFull;
        }
        this.attributesCache = attrs;
        return attrs;
    }

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
