import { DocumentManager, Document } from '../../lib/documents';
import { pathToUrl } from '../../utils';
import { getLanguageServiceForDocument } from './service';
import { TypescriptDocument } from './TypescriptDocument';

export class LSAndTSDocResovler {
    constructor(private readonly docManager: DocumentManager) { }
    createDocument = (fileName: string, content: string) => {
        const uri = pathToUrl(fileName);
        const document = this.docManager.openDocument({
            languageId: '',
            text: content,
            uri,
            version: 0,
        });
        this.docManager.lockDocument(uri);
        return new TypescriptDocument(document);
    };
    private documents = new Map<Document, TypescriptDocument>();
    public getLSAndTSDoc(document: Document) {
        let tsDoc = this.documents.get(document);
        if (!tsDoc) {
            tsDoc = new TypescriptDocument(document);
            this.documents.set(document, tsDoc);
        }
        const lang = getLanguageServiceForDocument(tsDoc, this.createDocument);
        return { tsDoc, lang };
    }
}
