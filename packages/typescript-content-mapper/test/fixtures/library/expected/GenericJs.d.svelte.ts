/** @template T */
declare function $$render<T>(): {
    props: {
        value: T;
        onchange?: (value: T) => void;
    };
    exports: {};
    bindings: "";
    slots: {};
    events: {};
};
/** @template T */
declare class __sveltets_Render<T> {
    /** @returns {ReturnType<typeof $$render<T>>['props']} */
    props(): ReturnType<typeof $$render<T>>['props'];
    /** @returns {ReturnType<typeof $$render<T>>['events']} */
    events(): ReturnType<typeof $$render<T>>['events'];
    /** @returns {ReturnType<typeof $$render<T>>['slots']} */
    slots(): ReturnType<typeof $$render<T>>['slots'];
    bindings(): "";
    exports(): {};
}
export declare const GenericJs: (new <T>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>>) => import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & {
    $$bindings?: ReturnType<__sveltets_Render<T>['bindings']>;
} & ReturnType<__sveltets_Render<T>['exports']>) & (<T>(internal: unknown, props: ReturnType<__sveltets_Render<T>['props']> & {}) => ReturnType<__sveltets_Render<T>['exports']>) & {
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
};
export type GenericJs = InstanceType<typeof GenericJs>;
export default GenericJs;
//# sourceMappingURL=GenericJs.d.svelte.ts.map