///<reference types="svelte" />
;function render() {

    /** @typedef {{a: number, b: string}}  $$ComponentProps *//** @type {$$ComponentProps} */
    let { a, b } = $props();
    let x = $state(0);
    let y = $derived(x * 2);
;
async () => {};
return { props: /** @type {$$ComponentProps} */({}), exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_with_any_event(render()));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;