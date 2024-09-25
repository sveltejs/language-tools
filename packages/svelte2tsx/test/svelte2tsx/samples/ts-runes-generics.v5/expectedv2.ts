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

type $$$Component<T> = import('svelte').Component<ReturnType<__sveltets_Render<T>['props']> & {}, ReturnType<__sveltets_Render<T>['exports']>, ReturnType<__sveltets_Render<any>['bindings']>> 
declare function Input__SvelteComponent_<T>(...args: Parameters<$$$Component<T>>): ReturnType<$$$Component<T>>;
Input__SvelteComponent_.z_$$bindings = null as any as ReturnType<__sveltets_Render<any>['bindings']>;
Input__SvelteComponent_.element = null as any;
export default Input__SvelteComponent_;