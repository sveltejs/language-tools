declare function $$render<T extends {
    id: string;
}>(): {
    props: {
        items: T[];
        onselect?: (item: T) => void;
    };
    exports: {
        first: () => T | undefined;
    };
    bindings: "";
    slots: {};
    events: {};
};
declare class __sveltets_Render<T extends {
    id: string;
}> {
    props(): ReturnType<typeof $$render<T>>['props'];
    events(): ReturnType<typeof $$render<T>>['events'];
    slots(): ReturnType<typeof $$render<T>>['slots'];
    bindings(): "";
    exports(): {
        first: () => T | undefined;
    };
}
interface $$IsomorphicComponent {
    new <T extends {
        id: string;
    }>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & {
        $$bindings?: ReturnType<__sveltets_Render<T>['bindings']>;
    } & ReturnType<__sveltets_Render<T>['exports']>;
    <T extends {
        id: string;
    }>(internal: unknown, props: ReturnType<__sveltets_Render<T>['props']> & {}): ReturnType<__sveltets_Render<T>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
declare const GenericTs: $$IsomorphicComponent;
type GenericTs<T extends {
    id: string;
}> = InstanceType<typeof GenericTs<T>>;
export default GenericTs;
//# sourceMappingURL=GenericTs.d.svelte.ts.map