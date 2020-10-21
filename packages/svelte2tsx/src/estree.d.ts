import { BaseNode } from 'estree';

// estree does not have start/end in their public Node interface,
// but the AST returned by svelte/compiler does.
// We add the those properties here and add Node as an interface
// to both estree and estree-walker.

declare module 'estree-walker' {
    export interface Node extends BaseNode {
        start: number;
        end: number;
        [propName: string]: any;
    }
}

declare module 'estree' {
    export interface BaseNode {
        start: number;
        end: number;
        [propName: string]: any;
    }
}
