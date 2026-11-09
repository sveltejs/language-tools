declare class __sveltets_Render<T extends boolean> {
    props(): {
        a: T;
    };
    events(): {
        b: CustomEvent<T>;
    };
    slots(): {
        default: {
            c: T;
        };
    };
    bindings(): string;
    exports(): {};
}
interface $$IsomorphicComponent {
    new <T extends boolean>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & {
        $$bindings?: ReturnType<__sveltets_Render<T>['bindings']>;
    } & ReturnType<__sveltets_Render<T>['exports']>;
    <T extends boolean>(internal: unknown, props: {
        $$events?: ReturnType<__sveltets_Render<T>['events']>;
    }): ReturnType<__sveltets_Render<T>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
declare const Interfaces: $$IsomorphicComponent;
type Interfaces<T extends boolean> = InstanceType<typeof Interfaces<T>>;
export default Interfaces;
