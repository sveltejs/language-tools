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
type $$$Component<T extends Record<string, any>, K extends keyof T> = import('svelte').Component<ReturnType<__sveltets_Render<T, K>['props']> & {}, ReturnType<__sveltets_Render<T, K>['exports']>, ReturnType<__sveltets_Render<any, any>['bindings']>>;
declare function TestRunes<T extends Record<string, any>, K extends keyof T>(...args: Parameters<$$$Component<T, K>>): ReturnType<$$$Component<T, K>>;
declare namespace TestRunes {
    var z_$$bindings: "bar";
    var element: any;
}
export default TestRunes;
