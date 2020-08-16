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
    events: Map<string, string | string[]>;
    isTsFile: boolean;
}

export interface Identifier {
    name: string;
    type: 'Identifier';
}

export interface ArrayPattern {
    type: 'ArrayPattern';
    start: number;
    end: number;
}

export interface ObjectPattern {
    type: 'ArrayPattern';
    start: number;
    end: number;
}

export interface BaseNode {
    type: string;
}
