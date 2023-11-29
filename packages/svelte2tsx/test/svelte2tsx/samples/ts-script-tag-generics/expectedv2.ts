///<reference types="svelte" />
;function render<T extends Record<string, any>>() {

     let init: T/*Ωignore_startΩ*/;init = __sveltets_2_any(init);/*Ωignore_endΩ*/;
;
async () => {};
return { props: {init: init} as {init: T}, slots: {}, events: {} }}
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
}


import { SvelteComponentTyped as __SvelteComponentTyped__ } from "svelte" 
export default class Input__SvelteComponent_<T extends Record<string, any>> extends __SvelteComponentTyped__<ReturnType<__sveltets_Render<T>['props']>, ReturnType<__sveltets_Render<T>['events']>, ReturnType<__sveltets_Render<T>['slots']>> {
}