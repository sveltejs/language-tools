import ts from 'typescript';
import { Document, Range } from '../../api';

export function getScriptKindFromFileName(fileName: string): ts.ScriptKind {
    const ext = fileName.substr(fileName.lastIndexOf('.'));
    switch (ext.toLowerCase()) {
        case ts.Extension.Js:
            return ts.ScriptKind.JS;
        case ts.Extension.Jsx:
            return ts.ScriptKind.JSX;
        case ts.Extension.Ts:
            return ts.ScriptKind.TS;
        case ts.Extension.Tsx:
            return ts.ScriptKind.TSX;
        case ts.Extension.Json:
            return ts.ScriptKind.JSON;
        default:
            return ts.ScriptKind.Unknown;
    }
}

export function getScriptKindFromAttributes(attrs: Record<string, string>): ts.ScriptKind {
    const type = attrs.lang || attrs.type;

    switch (type) {
        case 'typescript':
        case 'text/typescript':
            return ts.ScriptKind.TS;
        case 'javascript':
        case 'text/javascript':
        default:
            return ts.ScriptKind.JS;
    }
}

export function isSvelte(filePath: string) {
    return filePath.endsWith('.html') || filePath.endsWith('.svelte');
}

export function convertRange(
    document: Document,
    range: { start?: number; length?: number },
): Range {
    return Range.create(
        document.positionAt(range.start || 0),
        document.positionAt((range.start || 0) + (range.length || 0)),
    );
}
