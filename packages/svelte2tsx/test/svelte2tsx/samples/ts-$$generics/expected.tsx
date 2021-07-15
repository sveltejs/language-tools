///<reference types="svelte" />
<></>;
import { createEventDispatcher } from 'svelte';
function render/*Ωignore_startΩ*/<A,B extends keyof A,C extends boolean>/*Ωignore_endΩ*/() {

    

    
    
    

     let a: A;
     let b: B;
     let c: C;

    const dispatch = createEventDispatcher<{a: A}>();

/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/;
() => (<>

<slot c={__sveltets_ensureSlot("default","c",c)} /></>);
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


export default class Input__SvelteComponent_<A,B extends keyof A,C extends boolean> extends Svelte2TsxComponent<ReturnType<__sveltets_Render<A,B,C>['props']>, ReturnType<__sveltets_Render<A,B,C>['events']>, ReturnType<__sveltets_Render<A,B,C>['slots']>> {
}