///<reference types="svelte" />
;
import { createEventDispatcher } from 'svelte';
function render<A, B extends keyof A, C extends boolean>() {

    

     let a: A/*Ωignore_startΩ*/;a = __sveltets_2_any(a);/*Ωignore_endΩ*/;
     let b: B/*Ωignore_startΩ*/;b = __sveltets_2_any(b);/*Ωignore_endΩ*/;
     let c: C/*Ωignore_startΩ*/;c = __sveltets_2_any(c);/*Ωignore_endΩ*/;

    const dispatch = createEventDispatcher<{a: A}>();

     function getA() {
        return a;
    }

/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/;
async () => {

 { __sveltets_createSlot("default", { c,});}};
return { props: {a: a , b: b , c: c , getA: getA} as {a: A, b: B, c: C, getA?: typeof getA}, slots: {'default': {c:c}}, events: {...__sveltets_2_toEventTypings<{a: A}>()} }}
class __sveltets_Render<A,B extends keyof A,C extends boolean> {
    props() {
        return render<A,B,C>().props;
    }
    events() {
        return __sveltets_2_with_any_event(render<A,B,C>()).events;
    }
    slots() {
        return render<A,B,C>().slots;
    }
}


import { SvelteComponentTyped as __SvelteComponentTyped__ } from "svelte" 
export default class Input__SvelteComponent_<A,B extends keyof A,C extends boolean> extends __SvelteComponentTyped__<ReturnType<__sveltets_Render<A,B,C>['props']>, ReturnType<__sveltets_Render<A,B,C>['events']>, ReturnType<__sveltets_Render<A,B,C>['slots']>> {
    get getA() { return __sveltets_2_nonNullable(this.$$prop_def.getA) }
}