///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;type $$ComponentProps = { a: unknown, b?: boolean, c?: number, d?: string, e?: unknown, f?: unknown, g?: typeof foo, h?: Bar, i?: Baz };/*Ωignore_endΩ*/
    let { a, b = true, c = 1, d = '', e = null, f = {}, g = foo, h = null as Bar, i = null as any as Baz }: $$ComponentProps = $props(); 
;
async () => {};
return { props: {} as any as $$ComponentProps, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_with_any_event(render()));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;