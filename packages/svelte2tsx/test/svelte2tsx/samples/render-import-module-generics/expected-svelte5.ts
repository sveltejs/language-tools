///<reference types="svelte" />
;
	import { render } from "render";
;;function render_0</*Ωignore_startΩ*/T>/*Ωignore_endΩ*/() {

;
async () => {

};
return { props: /** @type {Record<string, never>} */ ({}), exports: {}, bindings: "", slots: {}, events: {} }}
class __sveltets_Render<T> {
    props() {
        return render_0<T>().props;
    }
    events() {
        return __sveltets_2_with_any_event(render_0<T>()).events;
    }
    slots() {
        return render_0<T>().slots;
    }
    bindings() { return ""; }
    exports() { return {}; }
}

interface $$IsomorphicComponent {
    new <T>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & { $$bindings?: ReturnType<__sveltets_Render<T>['bindings']> } & ReturnType<__sveltets_Render<T>['exports']>;
    <T>(internal: unknown, props: {$$events?: ReturnType<__sveltets_Render<T>['events']>}): ReturnType<__sveltets_Render<T>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
const Input__SvelteComponent_: $$IsomorphicComponent = null as any;
/*Ωignore_startΩ*/type Input__SvelteComponent_<T> = InstanceType<typeof Input__SvelteComponent_<T>>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;