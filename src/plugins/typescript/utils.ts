import ts from 'typescript';
import { Document, Range, SymbolKind } from '../../api';

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

export function symbolKindFromString(kind: string): SymbolKind {
    switch (kind) {
        case 'module':
            return SymbolKind.Module;
        case 'class':
            return SymbolKind.Class;
        case 'local class':
            return SymbolKind.Class;
        case 'interface':
            return SymbolKind.Interface;
        case 'enum':
            return SymbolKind.Enum;
        case 'enum member':
            return SymbolKind.Constant;
        case 'var':
            return SymbolKind.Variable;
        case 'local var':
            return SymbolKind.Variable;
        case 'function':
            return SymbolKind.Function;
        case 'local function':
            return SymbolKind.Function;
        case 'method':
            return SymbolKind.Method;
        case 'getter':
            return SymbolKind.Method;
        case 'setter':
            return SymbolKind.Method;
        case 'property':
            return SymbolKind.Property;
        case 'constructor':
            return SymbolKind.Constructor;
        case 'parameter':
            return SymbolKind.Variable;
        case 'type parameter':
            return SymbolKind.Variable;
        case 'alias':
            return SymbolKind.Variable;
        case 'let':
            return SymbolKind.Variable;
        case 'const':
            return SymbolKind.Constant;
        case 'JSX attribute':
            return SymbolKind.Property;
        default:
            return SymbolKind.Variable;
    }
}
