import { Location, Position, Range } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { pathToUrl } from '../../../utils';
import { FindComponentUsagesProvider } from '../../interfaces';
import { LSAndTSDocResolver } from '../LSAndTSDocResolver';
import {
    convertToLocationRange,
    convertToTextSpan,
    hasNonZeroRange,
    isSvelteFilePath
} from '../utils';
import { FindReferencesProviderImpl } from './FindReferencesProvider';
import { SnapshotFragmentMap } from './utils';
import { Document, DocumentManager } from '../../../lib/documents';
import ts, { ReferenceEntry, TextSpan } from 'typescript';
import { SnapshotFragment } from '../DocumentSnapshot';

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
            if (!ref.contextSpan) {
                continue;
            }

            const document = await this.getDocument(ref.fileName);
            const tsDoc = await this.getSnapshotForPath(ref.fileName);
            const fragment = tsDoc.getFragment();

            const docs = new SnapshotFragmentMap(this.lsAndTsDocResolver);
            docs.set(tsDoc.filePath, { fragment, snapshot: tsDoc });
            const defDoc = await docs.retrieveFragment(ref.fileName);

            const findReferenceTargetHelper = new FindReferenceTargetHelper(defDoc, ref, document);

            const findReferenceTargetPosition = findReferenceTargetHelper.GetReferenceTarget();
            if (!findReferenceTargetPosition) {
                continue;
            }

            const usageResults = await findReferenceProvider.findReferences(
                document,
                findReferenceTargetPosition,
                { includeDeclaration: true }
            );

            usageResults &&
                usageResults.forEach((element) => {
                    //Only report starting tags
                    if (this.isEndTag(element, document)) {
                        return;
                    }

                    componentUsages.push(
                        Location.create(
                            pathToUrl(ref.fileName),
                            convertToLocationRange(
                                defDoc,
                                this.convertTextSpan(
                                    ref,
                                    element,
                                    fragment,
                                    findReferenceTargetHelper
                                )
                            )
                        )
                    );
                });
        }

        // Some references are in generated code but not wrapped with explicit ignore comments.
        // These show up as zero-length ranges, so filter them out.
        return componentUsages.filter(hasNonZeroRange);
    }

    //Return correct span for a TS or SVELTE file
    private convertTextSpan(
        ref: ReferenceEntry,
        element: Location,
        fragment: SnapshotFragment,
        helper: FindReferenceTargetHelper
    ) {
        const textSpan = convertToTextSpan(element.range, fragment);

        //For whatever reason the references found in the script section of a .svelte file were off by 1
        if (helper.isSvelteFile && !helper.IsLocationWithinScriptSection(element)) {
            textSpan.length += 1;
        }

        return textSpan;
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

class FindReferenceTargetHelper {
    contextSpan: Range;
    contextSpanText: string;
    contextSpanTextSplit: string[];

    textSpan: Range;
    textSpanText: string;
    textSpanTextSplit: string[];

    dynamicImportTest = 'import(';

    isSvelteFile: boolean = false;

    constructor(
        public defDoc: SnapshotFragment,
        public fileReference: ReferenceEntry,
        public document: Document
    ) {
        this.contextSpan = convertToLocationRange(defDoc, fileReference.contextSpan as TextSpan);
        this.contextSpanText = document.getText(
            Range.create(this.contextSpan.start, this.contextSpan.end)
        );
        this.contextSpanTextSplit = this.contextSpanText.split(' ');

        this.textSpan = convertToLocationRange(defDoc, fileReference.textSpan);
        this.textSpanText = document.getText(Range.create(this.textSpan.start, this.textSpan.end));
        this.textSpanTextSplit = this.textSpanText.split(' ');

        this.isSvelteFile = isSvelteFilePath(fileReference.fileName);
    }

    public IsLocationWithinScriptSection(element: Location) {
        if (this.isSvelteFile && this.document.scriptInfo) {
            if (
                element.range.start.line > this.document.scriptInfo.startPos.line &&
                element.range.start.line < this.document.scriptInfo.endPos.line
            ) {
                return true;
            }
        }

        return false;
    }

    //Heuristic's for common and well formatted syntax patterns to find the appropriate reference target
    public GetReferenceTarget() {
        const position = this.GetTargetPosition();
        return position;
    }

    private GetTargetPosition() {
        const standardImportPosition = this.IsStandardImport();
        if (standardImportPosition) {
            return standardImportPosition;
        }

        const resolvedPromiseImport = this.IsResolvedPromiseImport();
        if (resolvedPromiseImport) {
            return resolvedPromiseImport;
        }

        const awaitImportPosition = this.IsAwaitImport();
        if (awaitImportPosition) {
            return awaitImportPosition;
        }

        const promiseImportPosition = this.IsPromiseImport();
        if (promiseImportPosition) {
            return promiseImportPosition;
        }
    }

    //import Btn from "./Button5.svelte";
    private IsStandardImport() {
        if (
            this.contextSpanTextSplit.length == 4 &&
            !this.contextSpanText.includes(this.dynamicImportTest)
        ) {
            return Position.create(
                this.contextSpan.start.line,
                this.contextSpan.start.character + 7
            );
        }
    }

    //const theModule = await import("./Button5.svelte");
    private IsAwaitImport() {
        if (
            this.contextSpanTextSplit.length == 5 &&
            this.contextSpanTextSplit.includes('await') &&
            this.contextSpanText.includes(this.dynamicImportTest)
        ) {
            if (this.isSvelteFile) {
                return Position.create(
                    this.textSpan.start.line,
                    this.textSpan.start.character - 17
                );
            } else {
                return Position.create(
                    this.contextSpan.start.line,
                    this.contextSpan.start.character - 17
                );
            }
        }
    }

    //const theModule2 = import("./Button5.svelte");
    private IsPromiseImport() {
        if (
            this.contextSpanTextSplit.length == 4 &&
            this.contextSpanText.includes(this.dynamicImportTest)
        ) {
            if (this.isSvelteFile) {
                return Position.create(
                    this.textSpan.start.line,
                    this.textSpan.start.character - 11
                );
            } else {
                return Position.create(
                    this.contextSpan.start.line,
                    this.contextSpan.start.character - 11
                );
            }
        }
    }

    //import("./Button5.svelte").then((module) => {
    private IsResolvedPromiseImport() {
        if (
            this.contextSpanText.startsWith(this.dynamicImportTest) &&
            this.contextSpanText.includes('then')
        ) {
            return Position.create(this.textSpan.start.line, this.textSpan.end.character + 9);
        }
    }
}
