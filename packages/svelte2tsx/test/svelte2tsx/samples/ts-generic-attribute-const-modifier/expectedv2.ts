///<reference types="svelte" />
;function render<const T extends readonly string[]>() {

 let items: T/*Ωignore_startΩ*/;items = __sveltets_2_any(items);/*Ωignore_endΩ*/;
;
async () => {};
return { props: {items: items}, slots: {}, events: {} }}
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
}


import { SvelteComponentTyped as __SvelteComponentTyped__ } from "svelte" 
export default class Input__SvelteComponent_<const T extends readonly string[]> extends __SvelteComponentTyped__<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> {
}