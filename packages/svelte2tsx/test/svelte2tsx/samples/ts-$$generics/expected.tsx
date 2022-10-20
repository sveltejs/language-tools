///<reference types="svelte" />
<></>;
import { createEventDispatcher } from 'svelte';
function render/*Ωignore_startΩ*/<A,B extends keyof A,C extends boolean>/*Ωignore_endΩ*/() {

    

    
    
    

     let a: A/*Ωignore_startΩ*/;a = __sveltets_1_any(a);/*Ωignore_endΩ*/;
     let b: B/*Ωignore_startΩ*/;b = __sveltets_1_any(b);/*Ωignore_endΩ*/;
     let c: C/*Ωignore_startΩ*/;c = __sveltets_1_any(c);/*Ωignore_endΩ*/;

    const dispatch = createEventDispatcher<{a: A}>();

     function getA() {
        return a;
    }

/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/;
() => (<>

<slot c={__sveltets_ensureSlot("default","c",c)} /></>);
return { props: {a: a , b: b , c: c , getA: getA} as {a: A, b: B, c: C, getA?: typeof getA}, slots: {'default': {c:c}}, events: {...__sveltets_1_toEventTypings<{a: A}>()} }}
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
    get getA() { return this.$$prop_def.getA }
}