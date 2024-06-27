///<reference types="svelte" />
;function render<T extends Record<string, any>>() {

     let init: T/*Ωignore_startΩ*/;init = __sveltets_2_any(init);/*Ωignore_endΩ*/;
;
async () => {};
return { props: {init: init} as {init: T}, exports: {}, bindings: "", slots: {}, events: {} }}
class __sveltets_Render<T extends Record<string, any>> {
    props() {
        return render<T>().props;
    }
    events() {
        return __sveltets_2_with_any_event(render<T>()).events;
    }
    slots() {
        return render<T>().slots;
    }
    bindings() { return ""; }
    exports() { return {}; }
}

interface $$IsomorphicComponent {
    new <T extends Record<string, any>>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & { $$bindings?: ReturnType<__sveltets_Render<T>['bindings']> } & ReturnType<__sveltets_Render<T>['exports']>;
    <T extends Record<string, any>>(internal: unknown, props: ReturnType<__sveltets_Render<T>['props']> & {$$events?: ReturnType<__sveltets_Render<T>['events']>}): ReturnType<__sveltets_Render<T>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
const Input__SvelteComponent_: $$IsomorphicComponent = null as any;
/*Ωignore_startΩ*/type Input__SvelteComponent_<T extends Record<string, any>> = InstanceType<typeof Input__SvelteComponent_<T>>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;