///<reference types="svelte" />
;function render<T>() {

    type Props = { a: T, b: string };
    let { a, b }: Props = $props();
    let x = $state<T>(0);
    let y = $derived(x * 2);

/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/;
async () => {

 { __sveltets_createSlot("default", {  x,y,});}};
let $$implicit_children = __sveltets_2_snippet({x:x, y:y});
return { props: {} as any as Props & { children?: typeof $$implicit_children }, slots: {'default': {x:x, y:y}}, events: {} }}
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
}