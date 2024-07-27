///<reference types="svelte" />
;
import type Foo from 'somewhere';
interface ReferencedByGeneric {
        b: true;
        f: Foo;
    }
function render/*Ωignore_startΩ*/<A,B extends ReferencedByGeneric>/*Ωignore_endΩ*/() {

    
    interface ReferencesGeneric {
        a: A;
    }
    
    
    
    

     let a: ReferencesGeneric/*Ωignore_startΩ*/;a = __sveltets_2_any(a);/*Ωignore_endΩ*/;
     let b: B/*Ωignore_startΩ*/;b = __sveltets_2_any(b);/*Ωignore_endΩ*/;
;
async () => {};
return { props: {a: a , b: b} as {a: ReferencesGeneric, b: B}, exports: {}, bindings: "", slots: {}, events: {} }}
class __sveltets_Render<A,B extends ReferencedByGeneric> {
    props() {
        return render<A,B>().props;
    }
    events() {
        return __sveltets_2_with_any_event(render<A,B>()).events;
    }
    slots() {
        return render<A,B>().slots;
    }
    bindings() { return ""; }
    exports() { return {}; }
}

interface $$IsomorphicComponent {
    new <A,B extends ReferencedByGeneric>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<A,B>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<A,B>['props']>, ReturnType<__sveltets_Render<A,B>['events']>, ReturnType<__sveltets_Render<A,B>['slots']>> & { $$bindings?: ReturnType<__sveltets_Render<A,B>['bindings']> } & ReturnType<__sveltets_Render<A,B>['exports']>;
    <A,B extends ReferencedByGeneric>(internal: unknown, props: ReturnType<__sveltets_Render<A,B>['props']> & {$$events?: ReturnType<__sveltets_Render<A,B>['events']>}): ReturnType<__sveltets_Render<A,B>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any,any>['bindings']>;
}
const Input__SvelteComponent_: $$IsomorphicComponent = null as any;
/*Ωignore_startΩ*/type Input__SvelteComponent_<A,B extends ReferencedByGeneric> = InstanceType<typeof Input__SvelteComponent_<A,B>>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;