import ts from 'typescript';
import { getScriptKindFromAttributes } from './utils';
import { TypescriptDocument } from './TypescriptDocument';

export interface DocumentSnapshot extends ts.IScriptSnapshot {
    version: number;
    scriptKind: ts.ScriptKind;
}

export const INITIAL_VERSION = 0

export namespace DocumentSnapshot {
    export function fromDocument(document: TypescriptDocument): DocumentSnapshot {
        const text = document.getText();
        const length = document.getTextLength();
        return {
            version: document.version,
            scriptKind: getScriptKindFromAttributes(document.getAttributes()),
            getText: (start, end) => text.substring(start, end),
            getLength: () => length,
            getChangeRange: () => undefined,
        };
    }
}
