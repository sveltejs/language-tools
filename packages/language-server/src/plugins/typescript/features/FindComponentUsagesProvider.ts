import { Location, Position } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { pathToUrl } from '../../../utils';
import { FindComponentUsagesProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import { convertToLocationRange, convertToTextSpan, hasNonZeroRange } from '../utils';
import { FindReferencesProviderImpl } from './FindReferencesProvider';
import { SnapshotFragmentMap } from './utils';
import { Document, DocumentManager } from '../../../lib/documents';
import ts from 'typescript';

export class FindComponentUsagesProviderImpl implements FindComponentUsagesProvider {
    constructor(private readonly lsAndTsDocResolver: LSAndTSDocResolver) {}

    async findComponentUsages(uri: string): Promise<Location[] | null> {
        const u = URI.parse(uri);
        const fileName = u.fsPath;
        const lang = await this.getLSForPath(fileName);

        const references = lang.getFileReferences(fileName);
        if (!references) {
            return null;
        }

        const componentUsages: Location[] = [];
        const findReferenceProvider = new FindReferencesProviderImpl(this.lsAndTsDocResolver);

        for (const ref of references) {
            const tsDoc = await this.getSnapshotForPath(ref.fileName);
            const fragment = tsDoc.getFragment();

            const docs = new SnapshotFragmentMap(this.lsAndTsDocResolver);
            docs.set(tsDoc.filePath, { fragment, snapshot: tsDoc });
            const defDoc = await docs.retrieveFragment(ref.fileName);

            if (!ref.contextSpan) {
                continue;
            }

            const contextSpan = convertToLocationRange(defDoc, ref.contextSpan);
            console.log(contextSpan);

            //Assume that if the reference spans more than one line it's a dynamic import. Flag it differently
            if (contextSpan.start.line != contextSpan.end.line) {
                componentUsages.push(
                    Location.create(
                        pathToUrl(ref.fileName),
                        convertToLocationRange(defDoc, convertToTextSpan(contextSpan, fragment))
                    )
                );

                continue;
            }

            const moduleNamePosition = Position.create(
                contextSpan.start.line,
                contextSpan.start.character + 7 // skip 7('import ') so that the position starts on the component name
            );

            const usageResults = await findReferenceProvider.findReferences(
                await this.getDocument(ref.fileName),
                moduleNamePosition,
                {
                    includeDeclaration: false
                }
            );

            usageResults &&
                usageResults.forEach((element) => {
                    componentUsages.push(
                        Location.create(
                            pathToUrl(ref.fileName),
                            convertToLocationRange(
                                defDoc,
                                convertToTextSpan(element.range, fragment)
                            )
                        )
                    );
                });
        }

        // Some references are in generated code but not wrapped with explicit ignore comments.
        // These show up as zero-length ranges, so filter them out.
        return componentUsages.filter(hasNonZeroRange);
    }

    private async getLSForPath(path: string) {
        return this.lsAndTsDocResolver.getLSForPath(path);
    }

    private async getSnapshotForPath(path: string) {
        return this.lsAndTsDocResolver.getSnapshot(path);
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
