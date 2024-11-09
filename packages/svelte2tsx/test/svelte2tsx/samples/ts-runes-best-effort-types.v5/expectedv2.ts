///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;type $$ComponentProps = { a: unknown, b?: boolean, c?: number, d?: string, e?: unknown, f?: Record<string, unknown>, g?: typeof foo, h?: Bar, i?: Baz, j?: unknown[], k?: unknown, l?: unknown, m?: number, n?: Function };/*Ωignore_endΩ*/
    let { a, b = true, c = 1, d = '', e = null, f = {}, g = foo, h = null as Bar, i = null as any as Baz, j = [], k = undefined, l = $bindable(), m = $bindable(1), n = () => {} }: $$ComponentProps = $props(); 
;
async () => {};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings('l', 'm'), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component(render());
type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
export default Input__SvelteComponent_;