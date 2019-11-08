declare module '*.svelte' {
    export default class {
        props: any;
    }
}

declare function __sveltets_ensureFunction(expression: (e: Event) => unknown ):any[];
declare function __sveltets_ensureString(expression: String ):any[];