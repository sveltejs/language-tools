import { Location, Position, Range } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { flatten, pathToUrl } from '../../../utils';
import { FindComponentUsagesProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToLocationRange, hasNonZeroRange } from '../utils';
import { Document, DocumentManager } from '../../../lib/documents';
import ts from 'typescript';
import { isNoTextSpanInGeneratedCode, SnapshotFragmentMap } from './utils';
import { SvelteSnapshotFragment } from '../DocumentSnapshot';
import { lsConfig } from '../../../ls-config';
export class FindComponentUsagesProviderImpl implements FindComponentUsagesProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async findComponentUsages(uri: string): Promise<Location[] | null> {
        const u = URI.parse(uri);
        const fileName = u.fsPath;
        const document = await this.getDocument(fileName);
        const { lang, tsDoc } = await this.getLSAndTSDoc(document);
        const fragment = tsDoc.getFragment();
        const ignoreImports =
            lsConfig.getConfig().typescript.findComponentUsagesIgnoresImports.enable;

        const position = this.GetClassPosition(fragment);

        const references = lang.findReferences(tsDoc.filePath, fragment.offsetAt(position));

        if (!references) {
            return null;
        }

        const docs = new SnapshotFragmentMap(this.lsAndTsDocResolver);
        docs.set(tsDoc.filePath, { fragment, snapshot: tsDoc });

        const locations = await Promise.all(
            flatten(references.map((ref) => ref.references))
                .filter((ref) => !ref.isDefinition)
                .filter(this.notInGeneratedCode(tsDoc.getFullText()))
                .map(async (ref) => {
                    const defDoc = await docs.retrieveFragment(ref.fileName);
                    const document = await this.getDocument(ref.fileName);

                    const refLocation = Location.create(
                        pathToUrl(ref.fileName),
                        convertToLocationRange(defDoc, ref.textSpan)
                    );

                    //Only report starting tags
                    if (this.isEndTag(refLocation, document)) {
                        return {} as Location;
                    }

                    if (ignoreImports && this.isStandardImport(refLocation, document)) {
                        return {} as Location;
                    }

                    return refLocation;
                })
        );

        // Some references are in generated code but not wrapped with explicit ignore comments.
        // These show up as zero-length ranges, so filter them out.
        return locations.filter(hasNonZeroRange);
    }

    //Return the position of the class in the generated code as the reference target
    private GetClassPosition(fragment: SvelteSnapshotFragment) {
        return fragment.positionAt(
            fragment.getLineOffsets()[fragment.getLineOffsets().length - 2] + 23
        );
    }

    private notInGeneratedCode(text: string) {
        return (ref: ts.ReferenceEntry) => {
            return isNoTextSpanInGeneratedCode(text, ref.textSpan);
        };
    }

    private isEndTag(element: Location, document: Document) {
        const testEndTagRange = Range.create(
            Position.create(element.range.start.line, element.range.start.character - 1),
            element.range.end
        );

        const text = document.getText(testEndTagRange);
        if (text.substring(0, 1) == '/') {
            return true;
        }

        return false;
    }

    private isStandardImport(element: Location, document: Document) {
        const testEndTagRange = Range.create(
            Position.create(element.range.start.line, 0),
            element.range.end
        );

        const text = document.getText(testEndTagRange);
        if (text.trim().startsWith('import')) {
            return true;
        }

        return false;
    }

    private async getLSAndTSDoc(document: Document) {
        return this.lsAndTsDocResolver.getLSAndTSDoc(document);
    }

    private async getDocument(filename: string) {
        const docManager = new DocumentManager(
            (textDocument) => new Document(textDocument.uri, textDocument.text)
        );

        const document = openDoc(filename);
        return document;

        function openDoc(filename: string) {
            const doc = docManager.openDocument(<any>{
                uri: pathToUrl(filename),
                text: ts.sys.readFile(filename) || ''
            });
            return doc;
        }
    }
}
