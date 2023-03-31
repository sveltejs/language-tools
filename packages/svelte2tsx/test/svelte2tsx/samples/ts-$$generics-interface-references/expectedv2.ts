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
return { props: {a: a , b: b} as {a: ReferencesGeneric, b: B}, slots: {}, events: {} }}
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
}


import { SvelteComponentTyped as __SvelteComponentTyped__ } from "svelte" 
export default class Input__SvelteComponent_<A,B extends ReferencedByGeneric> extends __SvelteComponentTyped__<ReturnType<__sveltets_Render<A,B>['props']>, ReturnType<__sveltets_Render<A,B>['events']>, ReturnType<__sveltets_Render<A,B>['slots']>> {
}