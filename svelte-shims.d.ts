declare module '*.svelte' {
    export default class {
        props: any;
    }
}

declare function svelteIf(expression: boolean): string