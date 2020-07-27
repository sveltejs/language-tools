import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { ExportedNames } from './nodes/ExportedNames';

export interface InstanceScriptProcessResult {
    exportedNames: ExportedNames;
    uses$$props: boolean;
    uses$$restProps: boolean;
    getters: Set<string>;
}

export interface CreateRenderFunctionPara extends InstanceScriptProcessResult {
    str: MagicString;
    scriptTag: Node;
    scriptDestination: number;
    slots: Map<string, Map<string, string>>;
    isTsFile: boolean;
}
