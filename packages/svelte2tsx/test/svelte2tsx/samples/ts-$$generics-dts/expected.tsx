import { SvelteComponentTyped } from "svelte"


import { createEventDispatcher } from 'svelte';
function render/*Ωignore_startΩ*/<A,B extends keyof A,C extends boolean>/*Ωignore_endΩ*/() {

    

    
    
    

     let a: A;
     let b: B;
     let c: C;

    const dispatch = createEventDispatcher<{a: A}>();
;
return { props: {a: a , b: b , c: c} as {a: A, b: B, c: C}, slots: {'default': {c:c}}, getters: {}, events: {...__sveltets_1_toEventTypings<{a: A}>()} }}
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
}