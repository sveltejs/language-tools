///<reference types="svelte" />
;function render() {

    let/** @typedef {{ props: unknown }} $$ComponentProps *//** @type {$$ComponentProps} */ { props } = $props();
    let state = $state(0);
    let derived = $derived(state * 2);
;
async () => {

state; derived;};
return { props: /** @type {$$ComponentProps} */({}), exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_with_any_event(render()));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;