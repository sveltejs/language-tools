import MagicString from 'magic-string';
import { Node } from 'estree-walker';

export type ExportedNames = Map<
    string,
    {
        type?: string;
        identifierText?: string;
        required?: boolean;
    }
>;

export interface InstanceScriptProcessResult {
    exportedNames: ExportedNames;
    uses$$props: boolean;
    uses$$restProps: boolean;
    getters: Set<string>;
    events: Map<string, string | string[]>;
}

export interface CreateRenderFunctionPara extends InstanceScriptProcessResult {
    str: MagicString;
    scriptTag: Node;
    scriptDestination: number;
    slots: Map<string, Map<string, string>>;
}
