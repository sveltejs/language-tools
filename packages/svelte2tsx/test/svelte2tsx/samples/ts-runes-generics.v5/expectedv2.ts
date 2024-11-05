///<reference types="svelte" />
;function render<T>() {
;type $$ComponentProps =  { a: T, b: string };
    let { a, b }:/*Ωignore_startΩ*/$$ComponentProps/*Ωignore_endΩ*/ = $props();
    let x = $state<T>(0);
    let y = $derived(x * 2);
;
async () => {};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
class __sveltets_Render<T> {
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
    new <T>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<T>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> & { $$bindings?: ReturnType<__sveltets_Render<T>['bindings']> } & ReturnType<__sveltets_Render<T>['exports']>;
    <T>(internal: unknown, props: ReturnType<__sveltets_Render<T>['props']> & {}): ReturnType<__sveltets_Render<T>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
const Input__SvelteComponent_: $$IsomorphicComponent = null as any;
/*Ωignore_startΩ*/type Input__SvelteComponent_<T> = InstanceType<typeof Input__SvelteComponent_<T>>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;