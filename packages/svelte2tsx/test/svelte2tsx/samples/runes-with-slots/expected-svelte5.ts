///<reference types="svelte" />
;function render() {

    /** @type {SomeType} */
    let { a, b } = $props();
    let x = $state(0);
    let y = $derived(x * 2);

/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/;
async () => {

 { __sveltets_createSlot("default", {  x,y,});}};
let $$implicit_children = __sveltets_2_snippet({x:x, y:y});
return { props: /** @type {{children?: typeof $$implicit_children} & SomeType} */({}), slots: {'default': {x:x, y:y}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['children'], __sveltets_2_with_any_event(render()))) {
}