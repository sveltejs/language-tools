///<reference types="svelte" />
;function render/*Ωignore_startΩ*/<A>/*Ωignore_endΩ*/() {

    

     let a: A/*Ωignore_startΩ*/;a = __sveltets_2_any(a);/*Ωignore_endΩ*/;
;
async () => {

  { svelteHTML.createElement("svelte:options", {"accessors":true,});}};
return { props: {a: a} as {a: A}, slots: {}, events: {} }}
class __sveltets_Render<A> {
    props() {
        return render<A>().props;
    }
    events() {
        return __sveltets_2_with_any_event(render<A>()).events;
    }
    slots() {
        return render<A>().slots;
    }
}


import { SvelteComponentTyped as __SvelteComponentTyped__ } from "svelte" 
export default class Input__SvelteComponent_<A> extends __SvelteComponentTyped__<ReturnType<__sveltets_Render<A>['props']>, ReturnType<__sveltets_Render<A>['events']>, ReturnType<__sveltets_Render<A>['slots']>> {
    get a() { return this.$$prop_def.a }
    /**accessor*/
    set a(_) {}
}