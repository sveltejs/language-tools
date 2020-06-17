import { Position, WorkspaceEdit, Range } from 'vscode-languageserver';
import {
    Document,
    mapRangeToOriginal,
    positionAt,
    offsetAt,
    getVariableAtPosition,
    getLineAtPosition,
} from '../../../lib/documents';
import { pathToUrl } from '../../../utils';
import { RenameProvider } from '../../interfaces';
import {
    SnapshotFragment,
    SvelteSnapshotFragment,
    SvelteDocumentSnapshot,
} from '../DocumentSnapshot';
import { convertRange } from '../utils';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import ts from 'typescript';
import { uniqWith, isEqual } from 'lodash';

export class RenameProviderImpl implements RenameProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async prepareRename(document: Document, position: Position): Promise<Range | null> {
        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();

        const offset = fragment.offsetAt(fragment.getGeneratedPosition(position));
        const renameInfo = this.getRenameInfo(lang, tsDoc, offset);
        if (!renameInfo) {
            return null;
        }

        return this.mapRangeToOriginal(fragment, renameInfo.triggerSpan);
    }

    async rename(
        document: Document,
        position: Position,
        newName: string,
    ): Promise<WorkspaceEdit | null> {
        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();

        const offset = fragment.offsetAt(fragment.getGeneratedPosition(position));

        if (!this.getRenameInfo(lang, tsDoc, offset)) {
            return null;
        }

        const renameLocations = lang.findRenameLocations(tsDoc.filePath, offset, false, false);
        if (!renameLocations) {
            return null;
        }

        const docs = new Map<string, SnapshotFragment>([[tsDoc.filePath, fragment]]);
        let convertedRenameLocations: (ts.RenameLocation & {
            range: Range;
        })[] = await this.mapRenameLocationsToParent(renameLocations, docs);
        // eslint-disable-next-line max-len
        const additionalRenameForPropRenameInsideComponentWithProp = await this.getAdditionLocationsForRenameOfPropInsideComponentWithProp(
            document,
            fragment,
            position,
            convertedRenameLocations,
            docs,
            lang,
        );
        const additionalRenamesForPropRenameOutsideComponentWithProp =
            // This is an either-or-situation, don't do both
            additionalRenameForPropRenameInsideComponentWithProp.length > 0
                ? []
                : await this.getAdditionalLocationsForRenameOfPropInsideOtherComponent(
                      convertedRenameLocations,
                      docs,
                      lang,
                  );
        convertedRenameLocations = [
            ...convertedRenameLocations,
            ...additionalRenameForPropRenameInsideComponentWithProp,
            ...additionalRenamesForPropRenameOutsideComponentWithProp,
        ];

        return unique(
            convertedRenameLocations.filter(
                (loc) => loc.range.start.line >= 0 && loc.range.end.line >= 0,
            ),
        ).reduce(
            (acc, loc) => {
                const uri = pathToUrl(loc.fileName);
                if (!acc.changes[uri]) {
                    acc.changes[uri] = [];
                }
                acc.changes[uri].push({ newText: newName, range: loc.range });
                return acc;
            },
            <Required<Pick<WorkspaceEdit, 'changes'>>>{ changes: {} },
        );
    }

    private getRenameInfo(
        lang: ts.LanguageService,
        tsDoc: SvelteDocumentSnapshot,
        offset: number,
    ): {
        canRename: true;
        kind: ts.ScriptElementKind;
        displayName: string;
        fullDisplayName: string;
        triggerSpan: { start: number; length: number };
    } | null {
        const renameInfo: any = lang.getRenameInfo(tsDoc.filePath, offset, {
            allowRenameOfImportPath: false,
        });
        // TODO this will also forbid renames of svelte component properties
        // in another component because the ScriptElementKind is a JSXAttribute.
        // To fix this we would need to enhance svelte2tsx with info methods like
        // "what props does this file have?"
        if (
            !renameInfo.canRename ||
            renameInfo.kind === ts.ScriptElementKind.jsxAttribute ||
            renameInfo.fullDisplayName?.startsWith('JSX.')
        ) {
            return null;
        }
        return renameInfo;
    }

    /**
     * If user renames prop of component A inside component A,
     * we need to handle the rename of the prop of A ourselves.
     * Reason: the rename will do {oldPropName: newPropName}, we have to handle
     * the conversion to {newPropName: newPropName} ourselves.
     */
    private async getAdditionLocationsForRenameOfPropInsideComponentWithProp(
        document: Document,
        fragment: SvelteSnapshotFragment,
        position: Position,
        convertedRenameLocations: (ts.RenameLocation & { range: Range })[],
        fragments: Map<string, SnapshotFragment>,
        lang: ts.LanguageService,
    ) {
        // First find out if it's really the "rename prop inside component with that prop" case
        // Use original document for that because only there the `export` is present.
        const regex = new RegExp(
            `export\\s+(const|let)\\s+${getVariableAtPosition(
                position,
                document.getText(),
            )}($|\\s|;|:)`, // ':' for typescript's type operator (`export let bla: boolean`)
        );
        const isRenameInsideComponentWithProp = regex.test(
            getLineAtPosition(position, document.getText()),
        );
        if (!isRenameInsideComponentWithProp) {
            return [];
        }
        // We now know that the rename happens at `export let X` -> let's find the corresponding
        // prop rename further below in the document.
        const updatePropLocation = this.findLocationWhichWantsToUpdatePropName(
            convertedRenameLocations,
            fragments,
        );
        if (!updatePropLocation) {
            return [];
        }
        // Typescript does a rename of `oldPropName: newPropName` -> find oldPropName and rename that, too.
        const idxOfOldPropName = fragment.text.lastIndexOf(':', updatePropLocation.textSpan.start);
        // This requires svelte2tsx to have the properties written down like `return props: {bla: bla}`.
        // It would not work for `return props: {bla}` because then typescript would do a rename of `{bla: renamed}`,
        // so other locations would not be affected.
        const replacementsForProp = (
            lang.findRenameLocations(updatePropLocation.fileName, idxOfOldPropName, false, false) ||
            []
        ).filter(
            (rename) =>
                // filter out all renames inside the component except the prop rename,
                // because the others were done before and then would show up twice, making a wrong rename.
                rename.fileName !== updatePropLocation.fileName ||
                this.isInSvelte2TsxPropLine(fragment, rename),
        );
        return await this.mapRenameLocationsToParent(replacementsForProp, fragments);
    }

    /**
     * If user renames prop of component A inside component B,
     * we need to handle the rename of the prop of A ourselves.
     * Reason: the rename will rename the prop in the computed svelte2tsx code,
     * but not the `export let X` code in the original. This additional logic
     * is done in this method.
     */
    private async getAdditionalLocationsForRenameOfPropInsideOtherComponent(
        convertedRenameLocations: (ts.RenameLocation & { range: Range })[],
        fragments: Map<string, SnapshotFragment>,
        lang: ts.LanguageService,
    ) {
        // Check if it's a prop rename
        const updatePropLocation = this.findLocationWhichWantsToUpdatePropName(
            convertedRenameLocations,
            fragments,
        );
        if (!updatePropLocation) {
            return [];
        }
        // Find generated `export let`
        const doc = <SvelteSnapshotFragment>fragments.get(updatePropLocation.fileName);
        const match = this.matchGeneratedExportLet(doc, updatePropLocation);
        if (!match) {
            return [];
        }
        // Use match to replace that let, too.
        const idx = (match.index || 0) + match[0].lastIndexOf(match[1]);
        const replacementsForProp =
            lang.findRenameLocations(updatePropLocation.fileName, idx, false, false) || [];
        return await this.mapRenameLocationsToParent(replacementsForProp, fragments);
    }

    private matchGeneratedExportLet(
        fragment: SvelteSnapshotFragment,
        updatePropLocation: ts.RenameLocation,
    ) {
        const regex = new RegExp(
            // no 'export let', only 'let', because that's what it's translated to in svelte2tsx
            `\\s+let\\s+(${fragment.text.substr(
                updatePropLocation.textSpan.start,
                updatePropLocation.textSpan.length,
            )})($|\\s|;|:)`,
        );
        const match = fragment.text.match(regex);
        return match;
    }

    private findLocationWhichWantsToUpdatePropName(
        convertedRenameLocations: (ts.RenameLocation & { range: Range })[],
        fragments: Map<string, SnapshotFragment>,
    ) {
        return convertedRenameLocations.find((loc) => {
            // Props are not in mapped range
            if (loc.range.start.line >= 0 && loc.range.end.line >= 0) {
                return;
            }

            const fragment = fragments.get(loc.fileName);
            // Props are in svelte snapshots only
            if (!(fragment instanceof SvelteSnapshotFragment)) {
                return false;
            }

            return this.isInSvelte2TsxPropLine(fragment, loc);
        });
    }

    private isInSvelte2TsxPropLine(fragment: SvelteSnapshotFragment, loc: ts.RenameLocation) {
        const pos = positionAt(loc.textSpan.start, fragment.text);
        const textInLine = fragment.text.substring(
            offsetAt({ ...pos, character: 0 }, fragment.text),
            loc.textSpan.start,
        );
        // This is how svelte2tsx writes out the props
        if (textInLine.includes('return { props: {')) {
            return true;
        }
    }

    /**
     * The rename locations the ts language services hands back are relative to the
     * svelte2tsx generated code -> map it back to the original document positions.
     * Some of those positions could be unmapped (line=-1), these are handled elsewhere.
     */
    private async mapRenameLocationsToParent(
        renameLocations: readonly ts.RenameLocation[],
        fragments: Map<string, SnapshotFragment>,
    ): Promise<(ts.RenameLocation & { range: Range })[]> {
        return Promise.all(
            renameLocations.map(async (loc) => {
                let doc = fragments.get(loc.fileName);
                if (!doc) {
                    doc = await this.getSnapshot(loc.fileName).getFragment();
                    fragments.set(loc.fileName, doc);
                }

                return {
                    ...loc,
                    range: this.mapRangeToOriginal(doc, loc.textSpan),
                };
            }),
        );
    }

    private mapRangeToOriginal(doc: SnapshotFragment, textSpan: ts.TextSpan): Range {
        // We need to work around a current svelte2tsx limitation: Replacements and
        // source mapping is done in such a way that sometimes the end of the range is unmapped
        // and the index of the last character is returned instead (which is one less).
        // Most of the time this is not much of a problem, but in the context of renaming, it is.
        // We work around that by adding +1 to the end, if necessary.
        // This can be done because
        // 1. we know renames can only ever occur in one line
        // 2. the generated svelte2tsx code will not modify variable names, so we know
        //    the original range should be the same length as the textSpan's length
        const range = mapRangeToOriginal(doc, convertRange(doc, textSpan));
        if (range.end.character - range.start.character < textSpan.length) {
            range.end.character++;
        }
        return range;
    }

    private getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }

    private getSnapshot(filePath: string, document?: Document) {
        return this.lsAndTsDocResolver.getSnapshot(filePath, document);
    }
}

function unique<T>(array: T[]): T[] {
    return uniqWith(array, isEqual);
}
