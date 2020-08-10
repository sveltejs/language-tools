import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { ExportedNames } from './nodes/ExportedNames';
import ts from 'typescript';

export interface InstanceScriptProcessResult {
    exportedNames: ExportedNames;
    uses$$props: boolean;
    uses$$restProps: boolean;
    getters: Set<string>;
    componentDef: ts.InterfaceDeclaration | undefined;
}

export interface CreateRenderFunctionPara extends InstanceScriptProcessResult {
    str: MagicString;
    scriptTag: Node;
    scriptDestination: number;
    slots: Map<string, Map<string, string>>;
    events: Map<string, string | string[]>;
    isTsFile: boolean;
}
