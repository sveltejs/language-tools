///<reference types="svelte" />
;function render() {

    let/** @typedef {{ a: unknown, b?: boolean, c?: number, d?: string, e?: unknown, f?: Record<string, unknown>, g?: typeof foo, h?: unknown[], i?: unknown, j?: unknown, k?: number, l?: Function }} $$ComponentProps *//** @type {$$ComponentProps} */ { a, b = true, c = 1, d = '', e = null, f = {}, g = foo, h = [], i = undefined, j = $bindable(), k = $bindable(1), l = () => {} } = $props(); 
;
async () => {};
return { props: /** @type {$$ComponentProps} */({}), exports: {}, bindings: __sveltets_$$bindings('j', 'k'), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_fn_component(render());
type Input__SvelteComponent_ = ReturnType<typeof Input__SvelteComponent_>;
export default Input__SvelteComponent_;