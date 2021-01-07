import { SemanticTokensLegend } from 'vscode-languageserver';

/**
 * extended from https://github.com/microsoft/TypeScript/blob/35c8df04ad959224fad9037e340c1e50f0540a49/src/services/classifier2020.ts#L9
 * so that we don't have to map it into our own legend
 */
export enum TokenType {
    class,
    enum,
    interface,
    namespace,
    typeParameter,
    type,
    parameter,
    variable,
    enumMember,
    property,
    function,

    // member is renamed to method in vscode to match LSP default
    method,

    // svelte
    event
}

/**
 * adopted from https://github.com/microsoft/TypeScript/blob/35c8df04ad959224fad9037e340c1e50f0540a49/src/services/classifier2020.ts#L13
 * so that we don't have to map it into our own legend
 */
export enum TokenModifier {
    declaration,
    static,
    async,
    readonly,
    defaultLibrary,
    local
}

function isEnumMember<T extends number>(value: string | T): value is T {
    return typeof value === 'number';
}

function extractEnumValues<T extends number>(values: Array<string | T>) {
    return values.filter(isEnumMember).sort((a, b) => a - b);
}

// enum is transpiled into an object with enum name and value mapping each other
export const semanticTokenLegends: SemanticTokensLegend = {
    tokenModifiers: extractEnumValues(Object.values(TokenModifier)).map(
        (modifier) => TokenModifier[modifier]
    ),
    tokenTypes: extractEnumValues(Object.values(TokenType)).map((tokenType) => TokenType[tokenType])
};
