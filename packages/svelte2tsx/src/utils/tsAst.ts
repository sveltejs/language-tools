import ts from 'typescript';

export function findExportKeyword(node: ts.Node) {
    return node.modifiers?.find((x) => x.kind == ts.SyntaxKind.ExportKeyword);
}

export function getGenericsDefinitionString(node: ts.InterfaceDeclaration | undefined): string {
    if (!(node?.typeParameters?.length > 0)) {
        return '';
    }

    return `<${node.typeParameters.map((param) => param.getText()).join(',')}>`;
}

export function getGenericsUsageString(node: ts.InterfaceDeclaration | undefined): string {
    if (!(node?.typeParameters?.length > 0)) {
        return '';
    }

    return `<${node.typeParameters.map((param) => param.name.text).join(',')}>`;
}

export function getComponentClassUsingInterfaceString(
    componentDef: ts.InterfaceDeclaration,
): string {
    return (
        `Svelte2TsxComponent<` +
        `ComponentDef${getGenericsUsageString(componentDef)}['props'], ` +
        `ComponentDef${getGenericsUsageString(componentDef)}['events'],` +
        `ComponentDef${getGenericsUsageString(componentDef)}['slots']>`
    );
}
