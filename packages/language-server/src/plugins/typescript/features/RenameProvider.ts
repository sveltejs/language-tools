import { Position, WorkspaceEdit, Range } from 'vscode-languageserver';
import { Document, mapRangeToOriginal, positionAt, offsetAt } from '../../../lib/documents';
import { pathToUrl } from '../../../utils';
import { RenameProvider } from '../../interfaces';
import { SnapshotFragment, SvelteSnapshotFragment } from '../DocumentSnapshot';
import { convertRange } from '../utils';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import ts from 'typescript';

export class RenameProviderImpl implements RenameProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async rename(
        document: Document,
        position: Position,
        newName: string,
    ): Promise<WorkspaceEdit | null> {
        const { lang, tsDoc } = this.getLSAndTSDoc(document);
        const fragment = await tsDoc.getFragment();

        const renameLocations = lang.findRenameLocations(
            tsDoc.filePath,
            fragment.offsetAt(fragment.getGeneratedPosition(position)),
            true,
            false,
        );
        if (!renameLocations) {
            return null;
        }

        const docs = new Map<string, SnapshotFragment>([[tsDoc.filePath, fragment]]);
        let convertedRenameLocations: (ts.RenameLocation & {
            range: Range;
        })[] = await this.mapRenameLocationsToParent(renameLocations, docs);
        convertedRenameLocations = [
            ...convertedRenameLocations,
            ...(await this.getAdditionalLocationsForPropRename(
                convertedRenameLocations,
                docs,
                lang,
            )),
        ];

        return convertedRenameLocations
            .filter((loc) => loc.range.start.line >= 0 && loc.range.end.line >= 0)
            .reduce(
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

    /**
     * If user renames prop of component A inside component B,
     * we need to handle the rename of the prop of A ourselves.
     * Reason: the rename will rename the prop in the computed svelte2tsx code,
     * but not the `export let X` code in the original. This additional logic
     * is done in this method.
     */
    private async getAdditionalLocationsForPropRename(
        convertedRenameLocations: (ts.RenameLocation & { range: Range })[],
        docs: Map<string, SnapshotFragment>,
        lang: ts.LanguageService,
    ) {
        const updatePropLocation = this.findLocationWhichWantsToUpdatePropName(
            convertedRenameLocations,
            docs,
        );
        if (!updatePropLocation) {
            return [];
        }

        const doc = <SvelteSnapshotFragment>docs.get(updatePropLocation.fileName);
        const regex = new RegExp(
            // no 'export let', only 'let', because that's what it's translated to in svelte2tsx
            `\\s+let\\s+(${doc.text.substr(
                updatePropLocation.textSpan.start,
                updatePropLocation.textSpan.length,
            )})($|\\s|;|:)`, // ':' for typescript's type operator (`export let bla: boolean`)
        );
        const match = doc.text.match(regex);
        if (!match) {
            return [];
        }

        const idx = (match.index || 0) + match[0].lastIndexOf(match[1]);
        const replacementsForProp =
            lang.findRenameLocations(updatePropLocation.fileName, idx, true, false) || [];
        return await this.mapRenameLocationsToParent(replacementsForProp, docs);
    }

    /**
     * The rename locations the ts language services hands back are relative to the
     * svelte2tsx generated code -> map it back to the original document positions.
     * Some of those positions could be unmapped (line=-1), these are handled elsewhere.
     */
    private async mapRenameLocationsToParent(
        renameLocations: readonly ts.RenameLocation[],
        docs: Map<string, SnapshotFragment>,
    ): Promise<(ts.RenameLocation & { range: Range })[]> {
        return Promise.all(
            renameLocations.map(async (loc) => {
                let doc = docs.get(loc.fileName);
                if (!doc) {
                    doc = await this.getSnapshot(loc.fileName).getFragment();
                    docs.set(loc.fileName, doc);
                }

                return {
                    ...loc,
                    range: mapRangeToOriginal(doc, convertRange(doc, loc.textSpan)),
                };
            }),
        );
    }

    private findLocationWhichWantsToUpdatePropName(
        convertedRenameLocations: (ts.RenameLocation & { range: Range })[],
        docs: Map<string, SnapshotFragment>,
    ) {
        return convertedRenameLocations.find((loc) => {
            // Props are not in mapped range
            if (loc.range.start.line >= 0 && loc.range.end.line >= 0) {
                return;
            }

            const doc = docs.get(loc.fileName);
            // Props are in svelte snapshots only
            if (!(doc instanceof SvelteSnapshotFragment)) {
                return false;
            }

            const pos = positionAt(loc.textSpan.start, doc.text);
            const textInLine = doc.text.substring(
                offsetAt({ ...pos, character: 0 }, doc.text),
                loc.textSpan.start,
            );
            // This is how svelte2tsx writes out the props
            if (textInLine.includes('return { props: {')) {
                return true;
            }
        });
    }

    private getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }

    private getSnapshot(filePath: string, document?: Document) {
        return this.lsAndTsDocResolver.getSnapshot(filePath, document);
    }
}
