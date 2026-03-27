declare module 'estree-walker' {
    export function walk(
        ast: import('estree').BaseNode,
        {
            enter,
            leave
        }: {
            enter?: (
                this: {
                    skip: () => void;
                    remove: () => void;
                    replace: (node: import('estree').BaseNode) => void;
                },
                node: import('estree').BaseNode,
                parent: import('estree').BaseNode,
                key: string,
                index: number
            ) => void;
            leave?: (
                this: {
                    skip: () => void;
                    remove: () => void;
                    replace: (node: import('estree').BaseNode) => void;
                },
                node: import('estree').BaseNode,
                parent: import('estree').BaseNode,
                key: string,
                index: number
            ) => void;
        }
    ): import('estree').BaseNode;

    export type BaseNode = import('estree').BaseNode;
}
