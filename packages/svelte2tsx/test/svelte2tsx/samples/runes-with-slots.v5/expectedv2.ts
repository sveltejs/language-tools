///<reference types="svelte" />
;function render() {

    /** @type {SomeType} */
    let { a, b } = $props();
    let x = $state(0);
    let y = $derived(x * 2);

/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/;
async () => {

 { __sveltets_createSlot("default", {  x,y,});}};
return { props: /** @type {SomeType} */({}), exports: {}, bindings: __sveltets_$$bindings(''), slots: {'default': {x:x, y:y}}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component_slots(__sveltets_2_with_any_event(render()));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;