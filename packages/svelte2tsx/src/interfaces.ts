import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import { ExportedNames } from './nodes/ExportedNames';
import { ComponentEvents } from './nodes/ComponentEvents';

export interface InstanceScriptProcessResult {
    exportedNames: ExportedNames;
    events: ComponentEvents;
    uses$$props: boolean;
    uses$$restProps: boolean;
    uses$$slots: boolean;
    getters: Set<string>;
}

export interface CreateRenderFunctionPara extends InstanceScriptProcessResult {
    str: MagicString;
    scriptTag: Node;
    scriptDestination: number;
    slots: Map<string, Map<string, string>>;
    events: ComponentEvents;
    isTsFile: boolean;
}

export interface AddComponentExportPara {
    str: MagicString;
    uses$$propsOr$$restProps: boolean;
    strictMode: boolean;
    /**
     * If true, not fallback to `CustomEvent<any>`
     * -> all unknown events will throw a type error
     * */
    strictEvents: boolean;
    isTsFile: boolean;
    getters: Set<string>;
    /** A named export allows for TSDoc-compatible docstrings */
    className?: string;
    componentDocumentation?: string | null;
}
