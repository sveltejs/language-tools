///<reference types="svelte" />
;function render<T>() {
;type $$ComponentProps =  { a: T, b: string };
    let { a, b }:$$ComponentProps = $props();
    let x = $state<T>(0);
    let y = $derived(x * 2);
;
async () => {};
return { props: {} as any as $$ComponentProps, slots: {}, events: {} }}
class __sveltets_Render<T> {
    props() {
        return render<T>().props;
    }
    events() {
        return __sveltets_2_with_any_event(render<T>()).events;
    }
    slots() {
        return render<T>().slots;
    }
}


import { SvelteComponentTyped as __SvelteComponentTyped__ } from "svelte" 
export default class Input__SvelteComponent_<T> extends __SvelteComponentTyped__<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> {
    constructor(options: import('svelte').ComponentConstructorOptions<__sveltets_2_PropsWithChildren<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['slots']>>>) { super(options); }
}