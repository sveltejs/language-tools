///<reference types="svelte" />
;function render<const T extends readonly string[]>() {

 let items: T/*Ωignore_startΩ*/;items = __sveltets_2_any(items);/*Ωignore_endΩ*/;
;
async () => {};
return { props: {items: items}, exports: {}, bindings: "", slots: {}, events: {} }}
class __sveltets_Render<const T extends readonly string[]> {
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
    new <const T extends readonly string[]>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & { $$bindings?: ReturnType<__sveltets_Render<T>['bindings']> } & ReturnType<__sveltets_Render<T>['exports']>;
    <const T extends readonly string[]>(internal: unknown, props: ReturnType<__sveltets_Render<T>['props']> & {$$events?: ReturnType<__sveltets_Render<T>['events']>}): ReturnType<__sveltets_Render<T>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
const Input__SvelteComponent_: $$IsomorphicComponent = null as any;
/*Ωignore_startΩ*/type Input__SvelteComponent_<const T extends readonly string[]> = InstanceType<typeof Input__SvelteComponent_<T>>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;