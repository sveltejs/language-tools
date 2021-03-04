import ts from 'typescript';
import { Position } from 'vscode-languageserver';
import { Document, getNodeIfIsInComponentStartTag, isInTag } from '../../../lib/documents';
import { SvelteDocumentSnapshot, SvelteSnapshotFragment } from '../DocumentSnapshot';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';

/**
 * If the given original position is within a Svelte starting tag,
 * return the snapshot of that component.
 */
export function getComponentAtPosition(
    lsAndTsDocResovler: LSAndTSDocResolver,
    lang: ts.LanguageService,
    doc: Document,
    tsDoc: SvelteDocumentSnapshot,
    fragment: SvelteSnapshotFragment,
    originalPosition: Position
): SvelteDocumentSnapshot | null {
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

    const generatedPosition = fragment.getGeneratedPosition(doc.positionAt(node.start + 1));
    const def = lang.getDefinitionAtPosition(
        tsDoc.filePath,
        fragment.offsetAt(generatedPosition)
    )?.[0];
    if (!def) {
        return null;
    }

    const snapshot = lsAndTsDocResovler.getSnapshot(def.fileName);
    if (!(snapshot instanceof SvelteDocumentSnapshot)) {
        return null;
    }
    return snapshot;
}

/**
 * Checks if this a section that should be completely ignored
 * because it's purely generated.
 */
export function isInGeneratedCode(text: string, start: number, end: number) {
    const lineStart = text.lastIndexOf('\n', start);
    const lineEnd = text.indexOf('\n', end);
    return (
        text.substring(lineStart, start).includes('/*Ωignore_startΩ*/') &&
        text.substring(end, lineEnd).includes('/*Ωignore_endΩ*/')
    );
}
