import { SvelteComponentTyped } from "svelte"

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
export type InputProps<A> = ReturnType<__sveltets_Render<A>['props']>;
export type InputEvents<A> = ReturnType<__sveltets_Render<A>['events']>;
export type InputSlots<A> = ReturnType<__sveltets_Render<A>['slots']>;

export default class Input<A> extends SvelteComponentTyped<InputProps<A>, InputEvents<A>, InputSlots<A>> {
    get a() { return this.$$prop_def.a }
    /**accessor*/
    set a(_) {}
}