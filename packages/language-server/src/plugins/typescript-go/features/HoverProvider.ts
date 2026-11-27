import { Hover, Position } from 'vscode-languageserver';
import { Document, getNodeIfIsInTagName, getWordAt } from '../../../lib/documents';
import { TsApiService } from '../TsApiService';
import { TsApiLocationMapper } from '../TsApiLocationMapper';
import type { tsApiAsync } from '../types';

/**
 * Hovers TS7 doesn't give in Svelte files (it returns null there), which the TS6 `HoverProvider`
 * added from the checker. What this does:
 * - a custom element tag (`<custom-element>`): the documentation of its
 *   `svelteHTML.IntrinsicElements` entry. (Its attributes do get TS7 hovers.)
 * - an `on:event` directive on a component (Svelte 4 style events): the event's type and docs, from
 *   the component instance's `$$events_def`
 */
export async function getFallbackHover(
    tsApi: TsApiService,
    document: Document,
    position: Position
): Promise<Hover | null> {
    const offset = document.offsetAt(position);
    const tag = getNodeIfIsInTagName(document.html, offset);
    if (tag?.tag?.includes('-')) {
        return getCustomElementHover(tsApi, document, tag.tag);
    }

    const word = getWordAt(document.getText(), offset, { left: /\S+$/, right: /[\s=]/ });
    if (word.startsWith('on:')) {
        return getComponentEventHover(tsApi, document, offset, word.slice('on:'.length));
    }
    return null;
}

async function getCustomElementHover(
    tsApi: TsApiService,
    document: Document,
    tagName: string
): Promise<Hover | null> {
    const documentation = await tsApi.withSourceFile(document.uri, async (project, sourceFile) => {
        if (sourceFile.originalText !== document.getText()) {
            return undefined;
        }
        const { SymbolFlags } = tsApi.apiModule;
        const checker = project.checker;
        // TODO: the namespace is configurable (tsconfig `svelteOptions.namespace`, which the
        // mapper uses)
        const namespace = await checker.resolveName(
            'svelteHTML',
            SymbolFlags.Namespace,
            sourceFile
        );
        const intrinsicElements = (await namespace?.getExports())?.get(
            'IntrinsicElements' as tsApiAsync.Symbol['escapedName']
        );
        if (!intrinsicElements) {
            return undefined;
        }
        const type = await checker.getDeclaredTypeOfSymbol(intrinsicElements);
        const element = await checker.getPropertyOfType(type, tagName);
        return element ? await checker.getDocumentationCommentOfSymbol(element) : undefined;
    });
    return documentation ? { contents: { kind: 'markdown', value: documentation } } : null;
}

async function getComponentEventHover(
    tsApi: TsApiService,
    document: Document,
    offset: number,
    eventName: string
): Promise<Hover | null> {
    const component = getNodeIfIsInComponentStartTag(document, offset);
    if (!component) {
        return null;
    }
    const text = await tsApi.withSourceFile(document.uri, async (project, sourceFile) => {
        if (sourceFile.originalText !== document.getText()) {
            return undefined;
        }
        const ast = tsApi.astModule;
        const { SymbolFlags, SignatureKind } = tsApi.apiModule;
        const checker = project.checker;
        const mapper = new TsApiLocationMapper(ast);
        // The component's name in the virtual code (the tag start also maps to generated code).
        // For `<UI.EventChild>` the last part: that is the component, `UI` only its container.
        const lastDot = component.tag.lastIndexOf('.');
        const name = component.tag.slice(lastDot + 1);
        const nameStart = component.start + 1 + lastDot + 1;
        const virtualOffset = mapper
            .toVirtualOffsets(sourceFile, nameStart, ast.SpanMapFeature.Definition)
            .find((virtual) => sourceFile.text.startsWith(name, virtual));
        if (virtualOffset === undefined) {
            return undefined;
        }
        let symbol: tsApiAsync.Symbol | undefined = await checker.getSymbolAtPosition(
            sourceFile.fileName,
            virtualOffset
        );
        if (symbol && symbol.flags & SymbolFlags.Alias) {
            symbol = await checker.getAliasedSymbol(symbol);
        }
        if (!symbol) {
            return undefined;
        }
        const componentType = await checker.getTypeOfSymbol(symbol);
        const [construct] = await checker.getSignaturesOfType(
            componentType,
            SignatureKind.Construct
        );
        if (!construct) {
            return undefined;
        }
        const instance = await checker.getReturnTypeOfSignature(construct);
        const eventsDef = await checker.getPropertyOfType(instance, '$$events_def');
        if (!eventsDef) {
            return undefined;
        }
        const events = await checker.getTypeOfSymbol(eventsDef);
        const event = await checker.getPropertyOfType(events, eventName);
        if (!event) {
            return undefined;
        }
        const type = await checker.typeToString(await checker.getTypeOfSymbol(event));
        const doc = await checker.getDocumentationCommentOfSymbol(event);
        return ['```typescript', `${eventName}: ${type}`, '```', doc || ''].join('\n');
    });
    return text ? { contents: { kind: 'markdown', value: text } } : null;
}

/** The start offset of the component start tag around `offset` (uppercase or dotted name) */
function getNodeIfIsInComponentStartTag(document: Document, offset: number) {
    const node = document.html.findNodeAt(offset);
    if (!node?.tag || !(/^[A-Z]/.test(node.tag) || node.tag.includes('.'))) {
        return undefined;
    }
    if (node.startTagEnd !== undefined && offset > node.startTagEnd) {
        return undefined;
    }
    return { start: node.start, tag: node.tag };
}
