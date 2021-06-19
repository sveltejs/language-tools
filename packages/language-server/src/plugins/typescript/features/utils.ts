import ts from 'typescript';
import { Position } from 'vscode-languageserver';
import {
    Document,
    getLineAtPosition,
    getNodeIfIsInComponentStartTag,
    isInTag
} from '../../../lib/documents';
import { DocumentSnapshot, SnapshotFragment, SvelteDocumentSnapshot } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';

/**
 * If the given original position is within a Svelte starting tag,
 * return the snapshot of that component.
 */
export async function getComponentAtPosition(
    lsAndTsDocResovler: LSAndTSDocResolver,
    lang: ts.LanguageService,
    doc: Document,
    tsDoc: SvelteDocumentSnapshot,
    originalPosition: Position
): Promise<SvelteDocumentSnapshot | null> {
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

    const node = getNodeIfIsInComponentStartTag(doc.html, doc.offsetAt(originalPosition));
    if (!node) {
        return null;
    }

    const fragment = await tsDoc.getFragment();
    const generatedPosition = fragment.getGeneratedPosition(doc.positionAt(node.start + 1));
    const def = lang.getDefinitionAtPosition(
        tsDoc.filePath,
        fragment.offsetAt(generatedPosition)
    )?.[0];
    if (!def) {
        return null;
    }

    const snapshot = await lsAndTsDocResovler.getSnapshot(def.fileName);
    if (!(snapshot instanceof SvelteDocumentSnapshot)) {
        return null;
    }
    return snapshot;
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

    return !!getNodeIfIsInComponentStartTag(doc.html, doc.offsetAt(originalPosition));
}

/**
 * Checks if this a section that should be completely ignored
 * because it's purely generated.
 */
export function isInGeneratedCode(text: string, start: number, end: number) {
    const lineStart = text.lastIndexOf('\n', start);
    const lineEnd = text.indexOf('\n', end);
    const lastStart = text.substring(lineStart, start).lastIndexOf('/*Ωignore_startΩ*/');
    const lastEnd = text.substring(lineStart, start).lastIndexOf('/*Ωignore_endΩ*/');
    return lastStart > lastEnd && text.substring(end, lineEnd).includes('/*Ωignore_endΩ*/');
}

/**
 * Checks that this isn't a text span that should be completely ignored
 * because it's purely generated.
 */
export function isNoTextSpanInGeneratedCode(text: string, span: ts.TextSpan) {
    return !isInGeneratedCode(text, span.start, span.start + span.length);
}

export function isPartOfImportStatement(text: string, position: Position): boolean {
    const line = getLineAtPosition(position, text);
    return /\s*from\s+["'][^"']*/.test(line.substr(0, position.character));
}

export class SnapshotFragmentMap {
    private map = new Map<string, { fragment: SnapshotFragment; snapshot: DocumentSnapshot }>();
    constructor(private resolver: LSAndTSDocResolver) {}

    set(fileName: string, content: { fragment: SnapshotFragment; snapshot: DocumentSnapshot }) {
        this.map.set(fileName, content);
    }

    get(fileName: string) {
        return this.map.get(fileName);
    }

    getFragment(fileName: string) {
        return this.map.get(fileName)?.fragment;
    }

    async retrieve(fileName: string) {
        let snapshotFragment = this.get(fileName);
        if (!snapshotFragment) {
            const snapshot = await this.resolver.getSnapshot(fileName);
            const fragment = await snapshot.getFragment();
            snapshotFragment = { fragment, snapshot };
            this.set(fileName, snapshotFragment);
        }
        return snapshotFragment;
    }

    async retrieveFragment(fileName: string) {
        return (await this.retrieve(fileName)).fragment;
    }
}

export function isAfterSvelte2TsxPropsReturn(text: string, end: number) {
    const textBeforeProp = text.substring(0, end);
    // This is how svelte2tsx writes out the props
    if (textBeforeProp.includes('\nreturn { props: {')) {
        return true;
    }
}
