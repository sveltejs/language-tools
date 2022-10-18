import { SvelteComponentTyped } from "svelte"


import { createEventDispatcher } from 'svelte';
function render/*Ωignore_startΩ*/<A,B extends keyof A,C extends boolean>/*Ωignore_endΩ*/() {

    

    
    
    

     let a: A/*Ωignore_startΩ*/;a = __sveltets_1_any(a);/*Ωignore_endΩ*/;
     let b: B/*Ωignore_startΩ*/;b = __sveltets_1_any(b);/*Ωignore_endΩ*/;
     let c: C/*Ωignore_startΩ*/;c = __sveltets_1_any(c);/*Ωignore_endΩ*/;

    const dispatch = createEventDispatcher<{a: A}>();

     function getA() {
        return a;
    }
;
return { props: {a: a , b: b , c: c , getA: getA} as {a: A, b: B, c: C, getA?: typeof getA}, slots: {'default': {c:c}}, getters: {getA: getA}, events: {...__sveltets_1_toEventTypings<{a: A}>()} }}
class __sveltets_Render<A,B extends keyof A,C extends boolean> {
    props() {
        return render<A,B,C>().props;
    }
    events() {
        return __sveltets_1_with_any_event(render<A,B,C>()).events;
    }
    slots() {
        return render<A,B,C>().slots;
    }
}
export type InputProps<A,B extends keyof A,C extends boolean> = ReturnType<__sveltets_Render<A,B,C>['props']>;
export type InputEvents<A,B extends keyof A,C extends boolean> = ReturnType<__sveltets_Render<A,B,C>['events']>;
export type InputSlots<A,B extends keyof A,C extends boolean> = ReturnType<__sveltets_Render<A,B,C>['slots']>;

export default class Input<A,B extends keyof A,C extends boolean> extends SvelteComponentTyped<InputProps<A,B,C>, InputEvents<A,B,C>, InputSlots<A,B,C>> {
    get getA() { return render<A,B,C>().getters.getA }
}