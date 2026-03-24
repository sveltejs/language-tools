///<reference types="svelte" />
;function $$render() {

    let/** @typedef {{ a: any, b: any }} $$ComponentProps *//** @type {$$ComponentProps} */ { a, b } = $props();
    let x = $state(0);
    let y = $derived(x * 2);
;
async () => {};
return { props: /** @type {$$ComponentProps} */({}), exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
export const Input__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*//** @typedef {ReturnType<typeof Input__SvelteComponent_>} Input__SvelteComponent_ */
/*Ωignore_endΩ*/export default Input__SvelteComponent_;