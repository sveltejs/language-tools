declare class __sveltets_Render<T extends Record<string, any>, K extends keyof T> {
    props(): {
        foo: T;
        bar?: K;
    };
    events(): {};
    slots(): {};
    bindings(): "bar";
    exports(): {
        baz: () => T;
    };
}
interface $$IsomorphicComponent {
    new <T extends Record<string, any>, K extends keyof T>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T, K>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T, K>['props']>, ReturnType<__sveltets_Render<T, K>['events']>, ReturnType<__sveltets_Render<T, K>['slots']>> & {
        $$bindings?: ReturnType<__sveltets_Render<T, K>['bindings']>;
    } & ReturnType<__sveltets_Render<T, K>['exports']>;
    <T extends Record<string, any>, K extends keyof T>(internal: unknown, props: ReturnType<__sveltets_Render<T, K>['props']> & {}): ReturnType<__sveltets_Render<T, K>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any, any>['bindings']>;
}
declare const TestRunes: $$IsomorphicComponent;
type TestRunes<T extends Record<string, any>, K extends keyof T> = InstanceType<typeof TestRunes<T, K>>;
export default TestRunes;
