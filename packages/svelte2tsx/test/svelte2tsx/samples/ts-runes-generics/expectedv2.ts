///<reference types="svelte" />
;function render() {

    let { a, b } = $props<{ a: number, b: string }>();
    let x = $state(0);
    let y = $derived(x * 2);

/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/;
async () => {

 { __sveltets_createSlot("default", {  x,y,});}};
return { props: {} as any as { a: number, b: string }, slots: {'default': {x:x, y:y}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
}