///<reference types="svelte" />
;function render() {

    let/** @typedef {{ a: unknown, b?: boolean, c?: number, d?: string, e?: unknown, f?: unknown, g?: typeof foo }} $$ComponentProps *//** @type {$$ComponentProps} */ { a, b = true, c = 1, d = '', e = null, f = {}, g = foo } = $props(); 
;
async () => {};
return { props: /** @type {$$ComponentProps} */({}), exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_with_any_event(render()));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;