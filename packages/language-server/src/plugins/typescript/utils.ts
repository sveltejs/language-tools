import ts from 'typescript';
import { Document, Range, SymbolKind, CompletionItemKind, DiagnosticSeverity } from '../../api';

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
    return filePath.endsWith('.svelte');
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

export function scriptElementKindToCompletionItemKind(
    kind: ts.ScriptElementKind,
): CompletionItemKind {
    switch (kind) {
        case ts.ScriptElementKind.primitiveType:
        case ts.ScriptElementKind.keyword:
            return CompletionItemKind.Keyword;
        case ts.ScriptElementKind.constElement:
            return CompletionItemKind.Constant;
        case ts.ScriptElementKind.letElement:
        case ts.ScriptElementKind.variableElement:
        case ts.ScriptElementKind.localVariableElement:
        case ts.ScriptElementKind.alias:
            return CompletionItemKind.Variable;
        case ts.ScriptElementKind.memberVariableElement:
        case ts.ScriptElementKind.memberGetAccessorElement:
        case ts.ScriptElementKind.memberSetAccessorElement:
            return CompletionItemKind.Field;
        case ts.ScriptElementKind.functionElement:
            return CompletionItemKind.Function;
        case ts.ScriptElementKind.memberFunctionElement:
        case ts.ScriptElementKind.constructSignatureElement:
        case ts.ScriptElementKind.callSignatureElement:
        case ts.ScriptElementKind.indexSignatureElement:
            return CompletionItemKind.Method;
        case ts.ScriptElementKind.enumElement:
            return CompletionItemKind.Enum;
        case ts.ScriptElementKind.moduleElement:
        case ts.ScriptElementKind.externalModuleName:
            return CompletionItemKind.Module;
        case ts.ScriptElementKind.classElement:
        case ts.ScriptElementKind.typeElement:
            return CompletionItemKind.Class;
        case ts.ScriptElementKind.interfaceElement:
            return CompletionItemKind.Interface;
        case ts.ScriptElementKind.warning:
        case ts.ScriptElementKind.scriptElement:
            return CompletionItemKind.File;
        case ts.ScriptElementKind.directory:
            return CompletionItemKind.Folder;
        case ts.ScriptElementKind.string:
            return CompletionItemKind.Constant;
    }
    return CompletionItemKind.Property;
}

export function getCommitCharactersForScriptElement(
    kind: ts.ScriptElementKind,
): string[] | undefined {
    const commitCharacters: string[] = [];
    switch (kind) {
        case ts.ScriptElementKind.memberGetAccessorElement:
        case ts.ScriptElementKind.memberSetAccessorElement:
        case ts.ScriptElementKind.constructSignatureElement:
        case ts.ScriptElementKind.callSignatureElement:
        case ts.ScriptElementKind.indexSignatureElement:
        case ts.ScriptElementKind.enumElement:
        case ts.ScriptElementKind.interfaceElement:
            commitCharacters.push('.');
            break;

        case ts.ScriptElementKind.moduleElement:
        case ts.ScriptElementKind.alias:
        case ts.ScriptElementKind.constElement:
        case ts.ScriptElementKind.letElement:
        case ts.ScriptElementKind.variableElement:
        case ts.ScriptElementKind.localVariableElement:
        case ts.ScriptElementKind.memberVariableElement:
        case ts.ScriptElementKind.classElement:
        case ts.ScriptElementKind.functionElement:
        case ts.ScriptElementKind.memberFunctionElement:
            commitCharacters.push('.', ',');
            commitCharacters.push('(');
            break;
    }

    return commitCharacters.length === 0 ? undefined : commitCharacters;
}

export function mapSeverity(category: ts.DiagnosticCategory): DiagnosticSeverity {
    switch (category) {
        case ts.DiagnosticCategory.Error:
            return DiagnosticSeverity.Error;
        case ts.DiagnosticCategory.Warning:
            return DiagnosticSeverity.Warning;
        case ts.DiagnosticCategory.Suggestion:
            return DiagnosticSeverity.Hint;
        case ts.DiagnosticCategory.Message:
            return DiagnosticSeverity.Information;
    }

    return DiagnosticSeverity.Error;
}
