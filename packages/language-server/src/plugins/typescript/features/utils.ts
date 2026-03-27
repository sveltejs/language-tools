import type ts from 'typescript';
import { Position, Range } from 'vscode-languageserver';
import {
    Document,
    getLineAtPosition,
    getNodeIfIsInComponentStartTag,
    isInTag
} from '../../../lib/documents';
import { ComponentInfoProvider, JsOrTsComponentInfoProvider } from '../ComponentInfoProvider';
import { DocumentSnapshot, SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { FileMap } from '../../../lib/documents/fileCollection';
import { LSConfig } from '../../../ls-config';
import { LanguageServiceContainer } from '../service';
import { internalHelpers } from 'svelte2tsx';

type NodePredicate = (tsModule: typeof ts, node: ts.Node) => boolean;

type NodeTypePredicate<T extends ts.Node> = (node: ts.Node) => node is T;
type NodeTypePredicateWithModule<T extends ts.Node> = (
    tsModule: typeof ts,
    node: ts.Node
) => node is T;

/**
 * If the given original position is within a Svelte starting tag,
 * return the snapshot of that component.
 */
export function getComponentAtPosition(
    tsModule: typeof ts,
    lang: ts.LanguageService,
    doc: Document,
    tsDoc: SvelteDocumentSnapshot,
    originalPosition: Position
): ComponentInfoProvider | null {
    if (tsDoc.parserError) {
        return null;
    }

    if (
        isInTag(originalPosition, doc.scriptInfo) ||
        isInTag(originalPosition, doc.moduleScriptInfo)
    ) {
        // Inside script tags -> not a component
        return null;
    }

    const node = getNodeIfIsInComponentStartTag(doc.html, doc, doc.offsetAt(originalPosition));
    if (!node) {
        return null;
    }

    const symbolPosWithinNode = node.tag?.includes('.') ? node.tag.lastIndexOf('.') + 1 : 0;

    const generatedPosition = tsDoc.getGeneratedPosition(
        doc.positionAt(node.start + symbolPosWithinNode + 1)
    );

    const def = lang.getDefinitionAtPosition(
        tsDoc.filePath,
        tsDoc.offsetAt(generatedPosition)
    )?.[0];
    if (!def) {
        return null;
    }

    return JsOrTsComponentInfoProvider.create(tsModule, lang, def, tsDoc.isSvelte5Plus);
}

export function isComponentAtPosition(
    doc: Document,
    tsDoc: SvelteDocumentSnapshot,
    originalPosition: Position
): boolean {
    if (tsDoc.parserError) {
        return false;
    }

    if (
        isInTag(originalPosition, doc.scriptInfo) ||
        isInTag(originalPosition, doc.moduleScriptInfo)
    ) {
        // Inside script tags -> not a component
        return false;
    }

    return !!getNodeIfIsInComponentStartTag(doc.html, doc, doc.offsetAt(originalPosition));
}

export const IGNORE_START_COMMENT = '/*Ωignore_startΩ*/';
export const IGNORE_END_COMMENT = '/*Ωignore_endΩ*/';
export const IGNORE_POSITION_COMMENT = '/*Ωignore_positionΩ*/';

/**
 * Surrounds given string with a start/end comment which marks it
 * to be ignored by tooling.
 */
export function surroundWithIgnoreComments(str: string): string {
    return IGNORE_START_COMMENT + str + IGNORE_END_COMMENT;
}

/**
 * Checks if this a section that should be completely ignored
 * because it's purely generated.
 */
export function isInGeneratedCode(text: string, start: number, end: number = start) {
    const lastStart = text.lastIndexOf(IGNORE_START_COMMENT, start);
    const lastEnd = text.lastIndexOf(IGNORE_END_COMMENT, start);
    const nextEnd = text.indexOf(IGNORE_END_COMMENT, end);
    // if lastEnd === nextEnd, this means that the str was found at the index
    // up to which is searched for it
    return (lastStart > lastEnd || lastEnd === nextEnd) && lastStart < nextEnd;
}

export function startsWithIgnoredPosition(text: string, offset: number) {
    return text.slice(offset).startsWith(IGNORE_POSITION_COMMENT);
}

/**
 * Checks if this is a text span that is inside svelte2tsx-generated code
 * (has no mapping to the original)
 */
export function isTextSpanInGeneratedCode(text: string, span: ts.TextSpan) {
    return isInGeneratedCode(text, span.start, span.start + span.length);
}

export function isPartOfImportStatement(text: string, position: Position): boolean {
    const line = getLineAtPosition(position, text);
    return /\s*from\s+["'][^"']*/.test(line.slice(0, position.character));
}

export function isStoreVariableIn$storeDeclaration(text: string, varStart: number) {
    return (
        text.lastIndexOf('__sveltets_2_store_get(', varStart) ===
        varStart - '__sveltets_2_store_get('.length
    );
}

export function get$storeOffsetOf$storeDeclaration(text: string, storePosition: number) {
    return text.lastIndexOf(' =', storePosition) - 1;
}

export function is$storeVariableIn$storeDeclaration(text: string, varStart: number) {
    return /^\$\w+ = __sveltets_2_store_get/.test(text.substring(varStart));
}

export function getStoreOffsetOf$storeDeclaration(text: string, $storeVarStart: number) {
    return text.indexOf(');', $storeVarStart) - 1;
}

export class SnapshotMap {
    private map: FileMap<DocumentSnapshot>;
    constructor(
        private resolver: LSAndTSDocResolver,
        private sourceLs: LanguageServiceContainer
    ) {
        this.map = new FileMap<DocumentSnapshot>(resolver.tsModule.sys.useCaseSensitiveFileNames);
    }

    set(fileName: string, snapshot: DocumentSnapshot) {
        this.map.set(fileName, snapshot);
    }

    get(fileName: string) {
        return this.map.get(fileName);
    }

    async retrieve(fileName: string) {
        let snapshot = this.get(fileName);
        if (snapshot) {
            return snapshot;
        }

        const snap =
            this.sourceLs.snapshotManager.get(fileName) ??
            // should not happen in most cases,
            // the file should be in the project otherwise why would we know about it
            (await this.resolver.getOrCreateSnapshot(fileName));

        this.set(fileName, snap);
        return snap;
    }
}

export function isAfterSvelte2TsxPropsReturn(text: string, end: number) {
    const textBeforeProp = text.substring(0, end);
    // This is how svelte2tsx writes out the props
    if (textBeforeProp.includes('\nreturn { props: {')) {
        return true;
    }
}

export function findContainingNode<T extends ts.Node>(
    node: ts.Node,
    textSpan: ts.TextSpan,
    predicate: (node: ts.Node) => node is T
): T | undefined {
    // TypeScript will re-parse part of the file in getChildren() to include syntax tokens.
    // But for the use cases of this function, we only need the actual nodes like Identifier.
    // the forEachChild name is a bit misleading too because it function more like find than forEach
    return node.forEachChild((child) => {
        if (child.getStart() <= textSpan.start && child.getEnd() >= textSpan.start) {
            if (predicate(child)) {
                return child;
            }
            const foundInChildren = findContainingNode(child, textSpan, predicate);
            if (foundInChildren) {
                return foundInChildren;
            }
        }
    });
}

export function findClosestContainingNode<T extends ts.Node>(
    node: ts.Node,
    textSpan: ts.TextSpan,
    predicate: (node: ts.Node) => node is T
): T | undefined {
    let current = findContainingNode(node, textSpan, predicate);
    if (!current) {
        return;
    }

    let closest = current;

    while (current) {
        const foundInChildren: T | undefined = findContainingNode(current, textSpan, predicate);

        closest = current;
        current = foundInChildren;
    }

    return closest;
}

/**
 * Finds node exactly matching span {start, length}.
 */
export function findNodeAtSpan<T extends ts.Node>(
    node: ts.Node,
    span: { start: number; length: number },
    predicate?: NodeTypePredicate<T>
): T | void {
    const { start, length } = span;

    const end = start + length;

    return node.forEachChild((child) => {
        const childStart = child.getStart();
        if (end <= childStart) {
            return;
        }

        const childEnd = child.getEnd();
        if (start >= childEnd) {
            return;
        }

        if (start === childStart && end === childEnd) {
            if (!predicate) {
                return child as T;
            }
            if (predicate(child)) {
                return child;
            }
        }

        const foundInChildren = findNodeAtSpan(child, span, predicate);
        if (foundInChildren) {
            return foundInChildren;
        }
    });
}

function isSomeAncestor(tsModule: typeof ts, node: ts.Node, predicate: NodePredicate) {
    for (let parent = node.parent; parent; parent = parent.parent) {
        if (predicate(tsModule, parent)) {
            return true;
        }
    }
    return false;
}

/**
 * Tests a node then its parent and successive ancestors for some respective predicates.
 */
function nodeAndParentsSatisfyRespectivePredicates<T extends ts.Node>(
    selfPredicate: NodePredicate | NodeTypePredicateWithModule<T>,
    ...predicates: NodePredicate[]
) {
    return (tsModule: typeof ts, node: ts.Node | undefined | void | null): node is T => {
        let next = node;
        return [selfPredicate, ...predicates].every((predicate) => {
            if (!next) {
                return false;
            }
            const current = next;
            next = next.parent;
            return predicate(tsModule, current);
        });
    };
}

const isRenderFunction = nodeAndParentsSatisfyRespectivePredicates<
    ts.FunctionDeclaration & { name: ts.Identifier }
>(
    (ts, node) =>
        ts.isFunctionDeclaration(node) && node?.name?.getText() === internalHelpers.renderName,
    (ts, node) => ts.isSourceFile(node)
);

const isRenderFunctionBody = nodeAndParentsSatisfyRespectivePredicates(
    (ts, node) => ts.isBlock(node),
    isRenderFunction
);

function or<T extends ts.Node>(...predicates: Array<NodePredicate>) {
    return (tsModule: typeof ts, x: T) => predicates.some((predicate) => predicate(tsModule, x));
}

export const isReactiveStatement = nodeAndParentsSatisfyRespectivePredicates<ts.LabeledStatement>(
    (ts, node) => ts.isLabeledStatement(node) && node.label.getText() === '$',
    or(
        // function $$render() {
        //     $: x2 = __sveltets_2_invalidate(() => x * x)
        // }
        isRenderFunctionBody,
        // function $$render() {
        //     ;() => {$: x, update();
        // }
        nodeAndParentsSatisfyRespectivePredicates(
            (ts, node) => ts.isBlock(node),
            (ts, node) => ts.isArrowFunction(node),
            (ts, node) => ts.isExpressionStatement(node),
            (ts, node) => isRenderFunctionBody(ts, node)
        )
    )
);

export function findRenderFunction(tsModule: typeof ts, sourceFile: ts.SourceFile) {
    // only search top level
    for (const child of sourceFile.statements) {
        if (isRenderFunction(tsModule, child)) {
            return child;
        }
    }
}

export const isInReactiveStatement = (tsModule: typeof ts, node: ts.Node) =>
    isSomeAncestor(tsModule, node, isReactiveStatement);

export function gatherDescendants<T extends ts.Node>(
    node: ts.Node,
    predicate: NodeTypePredicate<T>,
    dest: T[] = []
) {
    if (predicate(node)) {
        dest.push(node);
    } else {
        node.forEachChild((child) => {
            gatherDescendants(child, predicate, dest);
        });
    }
    return dest;
}

export const gatherIdentifiers = (tsModule: typeof ts, node: ts.Node) =>
    gatherDescendants(node, tsModule.isIdentifier);

export function isKitTypePath(path?: string): boolean {
    return !!path?.includes('.svelte-kit/types');
}

export function getFormatCodeBasis(
    formatCodeSetting: ts.FormatCodeSettings,
    defaultNewLine: string
): FormatCodeBasis {
    const { baseIndentSize, indentSize, convertTabsToSpaces } = formatCodeSetting;
    const baseIndent = convertTabsToSpaces
        ? ' '.repeat(baseIndentSize ?? 4)
        : baseIndentSize
          ? '\t'
          : '';
    const indent = convertTabsToSpaces ? ' '.repeat(indentSize ?? 4) : baseIndentSize ? '\t' : '';
    const semi = formatCodeSetting.semicolons === 'remove' ? '' : ';';
    const newLine = formatCodeSetting.newLineCharacter ?? defaultNewLine;

    return {
        baseIndent,
        indent,
        semi,
        newLine
    };
}

export interface FormatCodeBasis {
    baseIndent: string;
    indent: string;
    semi: string;
    newLine: string;
}

export function findChildOfKind(node: ts.Node, kind: ts.SyntaxKind): ts.Node | undefined {
    // this one we do want to use getChildren() because we also want to find syntax tokens,
    for (const child of node.getChildren()) {
        if (child.kind === kind) {
            return child;
        }

        const foundInChildren = findChildOfKind(child, kind);

        if (foundInChildren) {
            return foundInChildren;
        }
    }
}

export function getNewScriptStartTag(lsConfig: Readonly<LSConfig>, newLine: string) {
    const lang = lsConfig.svelte.defaultScriptLanguage;
    const scriptLang = lang === 'none' ? '' : ` lang="${lang}"`;
    return `<script${scriptLang}>${newLine}`;
}

export function checkRangeMappingWithGeneratedSemi(
    originalRange: Range,
    generatedRange: Range,
    tsDoc: SvelteDocumentSnapshot
) {
    const originalLength = originalRange.end.character - originalRange.start.character;
    const generatedLength = generatedRange.end.character - generatedRange.start.character;

    // sourcemap off by one character issue + a generated semicolon
    if (
        originalLength === generatedLength - 2 &&
        tsDoc.getFullText()[tsDoc.offsetAt(generatedRange.end) - 1] === ';'
    ) {
        originalRange.end.character += 1;
    }
}

/** Returns the list of registered custom elements and their description (from JSDoc) */
export function getCustomElementsTags(
    tsModule: typeof ts,
    lang: ts.LanguageService,
    lsContainer: LanguageServiceContainer,
    tsDoc: SvelteDocumentSnapshot
): string[] {
    const info = getCustomElementDocumentationSymbols(tsModule, lang, lsContainer, tsDoc);
    if (!info) {
        return [];
    }

    const symbols = info.type.getProperties().filter((s) => tsModule.symbolName(s).includes('-'));
    return symbols.map((s) => s.name);
}

export function getCustomElementsDocument(
    tsModule: typeof ts,
    lang: ts.LanguageService,
    lsContainer: LanguageServiceContainer,
    tsDoc: SvelteDocumentSnapshot,
    tagName: string
): string | null {
    const info = getCustomElementDocumentationSymbols(tsModule, lang, lsContainer, tsDoc);
    if (!info) {
        return null;
    }

    const tag = info.type.getProperty(tagName);
    return tag && tag.name.includes('-')
        ? tsModule.displayPartsToString(tag.getDocumentationComment(info.typeChecker))
        : null;
}

function getCustomElementDocumentationSymbols(
    tsModule: typeof ts,
    lang: ts.LanguageService,
    lsContainer: LanguageServiceContainer,
    tsDoc: SvelteDocumentSnapshot
): { type: ts.Type; typeChecker: ts.TypeChecker } | null {
    const program = lang.getProgram();
    const sourceFile = program?.getSourceFile(tsDoc.filePath);
    const typeChecker = program?.getTypeChecker();
    if (!typeChecker || !sourceFile) {
        return null;
    }

    const typingsNamespace = lsContainer.getTsConfigSvelteOptions().namespace;

    const typingsNamespaceSymbol = findTypingsNamespaceSymbol(
        tsModule,
        typingsNamespace,
        typeChecker,
        sourceFile
    );

    if (!typingsNamespaceSymbol) {
        return null;
    }

    const elements = typeChecker
        .getExportsOfModule(typingsNamespaceSymbol)
        .find((symbol) => symbol.name === 'IntrinsicElements');

    if (!elements || !(elements.flags & tsModule.SymbolFlags.Interface)) {
        return null;
    }

    const type = typeChecker.getDeclaredTypeOfSymbol(elements);

    return { type, typeChecker };
}

function findTypingsNamespaceSymbol(
    tsModule: typeof ts,
    namespaceExpression: string,
    typeChecker: ts.TypeChecker,
    sourceFile: ts.SourceFile
) {
    if (!namespaceExpression || typeof namespaceExpression !== 'string') {
        return;
    }

    const [first, ...rest] = namespaceExpression.split('.');

    let symbol: ts.Symbol | undefined = typeChecker
        .getSymbolsInScope(sourceFile, tsModule.SymbolFlags.Namespace)
        .find((symbol) => symbol.name === first);

    for (const part of rest) {
        if (!symbol) {
            return;
        }

        symbol = typeChecker.getExportsOfModule(symbol).find((symbol) => symbol.name === part);
    }

    return symbol;
}
