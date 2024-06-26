///<reference types="svelte" />
;function render/*Ωignore_startΩ*/<A>/*Ωignore_endΩ*/() {

    

     let a: A/*Ωignore_startΩ*/;a = __sveltets_2_any(a);/*Ωignore_endΩ*/;
;
async () => {

  { svelteHTML.createElement("svelte:options", {"accessors":true,});}};
return { props: {a: a} as {a: A}, exports: {} as any as { a: A }, bindings: "", slots: {}, events: {} }}
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
    bindings() { return ""; }
    exports() { return render<A>().exports; }
}

interface $$IsomorphicComponent {
    new <A>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<A>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<A>['props']>, ReturnType<__sveltets_Render<A>['events']>, ReturnType<__sveltets_Render<A>['slots']>> & { $$bindings?: ReturnType<__sveltets_Render<A>['bindings']> } & ReturnType<__sveltets_Render<A>['exports']>;
    <A>(internal: unknown, props: ReturnType<__sveltets_Render<A>['props']> & {$$events?: ReturnType<__sveltets_Render<A>['events']>}): ReturnType<__sveltets_Render<A>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any>['bindings']>;
}
const Input__SvelteComponent_: $$IsomorphicComponent = null as any;
/*Ωignore_startΩ*/type Input__SvelteComponent_<A> = InstanceType<typeof Input__SvelteComponent_<A>>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;