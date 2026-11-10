declare function $$render<T extends Record<string, any>, K extends keyof T>(): Promise<{
    props: {
        foo: T;
        bar?: K;
    };
    exports: {};
    bindings: "bar";
    slots: {};
    events: {};
}>;
declare class __sveltets_Render<T extends Record<string, any>, K extends keyof T> {
    props(): Awaited<ReturnType<typeof $$render<T, K>>>['props'];
    events(): Awaited<ReturnType<typeof $$render<T, K>>>['events'];
    slots(): Awaited<ReturnType<typeof $$render<T, K>>>['slots'];
    bindings(): "bar";
    exports(): Promise<{}>;
}
interface $$IsomorphicComponent {
    new <T extends Record<string, any>, K extends keyof T>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T, K>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T, K>['props']>, ReturnType<__sveltets_Render<T, K>['events']>, ReturnType<__sveltets_Render<T, K>['slots']>> & {
        $$bindings?: ReturnType<__sveltets_Render<T, K>['bindings']>;
    } & ReturnType<__sveltets_Render<T, K>['exports']>;
    <T extends Record<string, any>, K extends keyof T>(internal: unknown, props: ReturnType<__sveltets_Render<T, K>['props']> & {}): ReturnType<__sveltets_Render<T, K>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any, any>['bindings']>;
}
declare const TestRunes1: $$IsomorphicComponent;
type TestRunes1<T extends Record<string, any>, K extends keyof T> = InstanceType<typeof TestRunes1<T, K>>;
export default TestRunes1;
