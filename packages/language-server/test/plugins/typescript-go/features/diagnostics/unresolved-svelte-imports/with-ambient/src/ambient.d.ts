// the project's own declaration: imports of any .svelte file are fine
declare module '*.svelte' {
    const Component: any;
    export default Component;
}
