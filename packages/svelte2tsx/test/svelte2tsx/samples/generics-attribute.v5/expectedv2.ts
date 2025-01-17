///<reference types="svelte" />
;function $$render</*Ωignore_startΩ*/A, B extends keyof A, C extends boolean>/*Ωignore_endΩ*/() {

    /** @typedef {{ a: A; b: B; c: C }}  $$ComponentProps *//** @type {$$ComponentProps} */
    const { a, b, c } = $props();

     function getA() {
        return a;
    }
;
async () => {};
return { props: /** @type {$$ComponentProps} */({}), exports: /** @type {{getA: typeof getA}} */ ({}), bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
class __sveltets_Render<A,B extends keyof A,C extends boolean> {
    props(): ReturnType<typeof $$render<A,B,C>>['props'] { return null as any; }
    events(): ReturnType<typeof $$render<A,B,C>>['events'] { return null as any; }
    slots(): ReturnType<typeof $$render<A,B,C>>['slots'] { return null as any; }
    bindings() { return __sveltets_$$bindings(''); }
    exports() { return $$render<A,B,C>().exports; }
}

interface $$IsomorphicComponent {
    new <A,B extends keyof A,C extends boolean>(options: import('svelte').ComponentConstructorOptions<ReturnType<__sveltets_Render<A,B,C>['props']>>): import('svelte').SvelteComponent<ReturnType<__sveltets_Render<A,B,C>['props']>, ReturnType<__sveltets_Render<A,B,C>['events']>, ReturnType<__sveltets_Render<A,B,C>['slots']>> & { $$bindings?: ReturnType<__sveltets_Render<A,B,C>['bindings']> } & ReturnType<__sveltets_Render<A,B,C>['exports']>;
    <A,B extends keyof A,C extends boolean>(internal: unknown, props: ReturnType<__sveltets_Render<A,B,C>['props']> & {}): ReturnType<__sveltets_Render<A,B,C>['exports']>;
    z_$$bindings?: ReturnType<__sveltets_Render<any,any,any>['bindings']>;
}
const Input__SvelteComponent_: $$IsomorphicComponent = null as any;
/*Ωignore_startΩ*/type Input__SvelteComponent_<A,B extends keyof A,C extends boolean> = InstanceType<typeof Input__SvelteComponent_<A,B,C>>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;