import { CompletionItem, CompletionItemKind, CompletionList } from 'vscode-languageserver';
import { AttributeInfo } from '../../../lib/documents/parseHtml';
import { CSSDocument } from '../CSSDocument';

export function getIdClassCompletion(
    cssDoc: CSSDocument,
    currentAttrInfo: AttributeInfo
): CompletionList | undefined {
    const collectingType = getCollectingType(currentAttrInfo);

    if (!collectingType) {
        return;
    }
    const items = collectSelectors(cssDoc.stylesheet as CSSNode, collectingType);

    return CompletionList.create(items);
}

function getCollectingType(currentAttrInfo: AttributeInfo): number | undefined {
    if (currentAttrInfo.inValue) {
        if (currentAttrInfo.name === 'class') {
            return NodeType.ClassSelector;
        }
        if (currentAttrInfo.name === 'id') {
            return NodeType.IdentifierSelector;
        }
    } else if (currentAttrInfo.name.startsWith('class:')) {
        return NodeType.ClassSelector;
    }
}

/**
 * incomplete see
 * https://github.com/microsoft/vscode-css-languageservice/blob/master/src/parser/cssNodes.ts#L14
 * The enum is not exported. we have to update this whenever it changes
 */
export enum NodeType {
    ClassSelector = 14,
    IdentifierSelector = 15
}

export type CSSNode = {
    type: number;
    children: CSSNode[] | undefined;
    getText(): string;
};

export function collectSelectors(stylesheet: CSSNode, type: number) {
    const result: CSSNode[] = [];
    walk(stylesheet, (node) => {
        if (node.type === type) {
            result.push(node);
        }
    });

    return result.map(
        (node): CompletionItem => ({
            label: node.getText().substring(1),
            kind: CompletionItemKind.Keyword
        })
    );
}

function walk(node: CSSNode, callback: (node: CSSNode) => void) {
    callback(node);
    if (node.children) {
        node.children.forEach((node) => walk(node, callback));
    }
}
