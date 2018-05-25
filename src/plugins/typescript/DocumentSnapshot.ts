import ts from 'typescript';
import { Document } from '../../api';
import { getScriptKindFromTypeAttribute } from './utils';

export interface DocumentSnapshot extends ts.IScriptSnapshot {
    version: number;
    scriptKind: ts.ScriptKind;
}

export namespace DocumentSnapshot {
    export function fromDocument(document: Document): DocumentSnapshot {
        const text = document.getText();
        const length = document.getTextLength();
        return {
            version: document.version,
            scriptKind: getScriptKindFromTypeAttribute(document.getAttributes().type),
            getText: (start, end) => text.substring(start, end),
            getLength: () => length,
            getChangeRange: () => undefined,
        };
    }
}
