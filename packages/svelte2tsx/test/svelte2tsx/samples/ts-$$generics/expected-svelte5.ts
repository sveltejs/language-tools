///<reference types="svelte" />
;
import { createEventDispatcher } from 'svelte';
function render/*Ωignore_startΩ*/<A,B extends keyof A,C extends boolean>/*Ωignore_endΩ*/() {

    

    
    
    

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
return { props: {a: a , b: b , c: c , getA: getA} as {a: A, b: B, c: C, getA?: typeof getA}, exports: {} as any as { getA: typeof getA }, bindings: "", slots: {'default': {c:c}}, events: {...__sveltets_2_toEventTypings<{a: A}>()} }}
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
    bindings() { return ""; }
    exports() { return render<A,B,C>().exports; }
}

interface $$IsomorphicComponent {
    new <A,B extends keyof A,C extends boolean>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<A,B,C>['props']>& {children?: any}>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<A,B,C>['props']>, ReturnType<__sveltets_Render<A,B,C>['events']>, ReturnType<__sveltets_Render<A,B,C>['slots']>> & { $$bindings?: ReturnType<__sveltets_Render<A,B,C>['bindings']> } & ReturnType<__sveltets_Render<A,B,C>['exports']>;
    <A,B extends keyof A,C extends boolean>(internal: unknown, props: ReturnType<__sveltets_Render<A,B,C>['props']> & {$$events?: ReturnType<__sveltets_Render<A,B,C>['events']>, $$slots?: ReturnType<__sveltets_Render<A,B,C>['slots']>, children?: any}): ReturnType<__sveltets_Render<A,B,C>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any,any,any>['bindings']>;
}
const Input__SvelteComponent_: $$IsomorphicComponent = null as any;
/*Ωignore_startΩ*/type Input__SvelteComponent_<A,B extends keyof A,C extends boolean> = InstanceType<typeof Input__SvelteComponent_<A,B,C>>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;