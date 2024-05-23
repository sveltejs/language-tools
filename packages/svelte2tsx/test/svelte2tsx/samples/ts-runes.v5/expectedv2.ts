///<reference types="svelte" />
;function render() {
;type $$ComponentProps =  { a: number, b: string };
    let { a, b }:/*Ωignore_startΩ*/$$ComponentProps/*Ωignore_endΩ*/ = $props();
    let x = $state(0);
    let y = $derived(x * 2);
;
async () => {};
return { props: {} as any as $$ComponentProps, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_with_any_event(render()));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;