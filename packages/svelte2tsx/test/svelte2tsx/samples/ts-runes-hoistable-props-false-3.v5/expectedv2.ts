///<reference types="svelte" />
;
    type SomeType<T extends boolean> = T;
    type T = unknown;
;;function render<T extends boolean>() {
;type $$ComponentProps =  { someProp: SomeType<T>; };
    let { someProp }:/*Ωignore_startΩ*/$$ComponentProps/*Ωignore_endΩ*/ = $props();
;
async () => {

};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
class __sveltets_Render<T extends boolean> {
    props() {
        return render<T>().props;
    }
    events() {
        return render<T>().events;
    }
    slots() {
        return render<T>().slots;
    }
    bindings() { return __sveltets_$$bindings(''); }
    exports() { return {}; }
}

interface $$IsomorphicComponent {
    new <T extends boolean>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & { $$bindings?: ReturnType<__sveltets_Render<T>['bindings']> } & ReturnType<__sveltets_Render<T>['exports']>;
    <T extends boolean>(internal: unknown, props: ReturnType<__sveltets_Render<T>['props']> & {}): ReturnType<__sveltets_Render<T>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
const Input__SvelteComponent_: $$IsomorphicComponent = null as any;
/*Ωignore_startΩ*/type Input__SvelteComponent_<T extends boolean> = InstanceType<typeof Input__SvelteComponent_<T>>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;