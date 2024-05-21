///<reference types="svelte" />
;function render() {
;type $$ComponentProps =  { a: number, b: string };
    let { a, b }:/*Ωignore_startΩ*/$$ComponentProps/*Ωignore_endΩ*/ = $props();
    let x = $state(0);
    let y = $derived(x * 2);
;
async () => {};
return { props: {} as any as $$ComponentProps, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
    constructor(options = __sveltets_2_runes_constructor(__sveltets_2_with_any_event(render()))) { super(options); }
    $$bindings = __sveltets_$$bindings('');
}