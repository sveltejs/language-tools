///<reference types="svelte" />
;function $$render<T>() {

     let a: T/*Ωignore_startΩ*/;a = __sveltets_2_any();a;/*Ωignore_endΩ*/;
;
async () => {};
return { props: {a: a} as {a: T}, slots: {}, events: {} }}
class __sveltets_Render<T> {
    props() {
        return $$render<T>().props;
    }
    events() {
        return __sveltets_2_with_any_event($$render<T>()).events;
    }
    slots() {
        return $$render<T>().slots;
    }
}


import { SvelteComponentTyped as __SvelteComponentTyped__ } from "svelte" 
export default class Input__SvelteComponent_<T> extends __SvelteComponentTyped__<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> {
}