///<reference types="svelte" />
;function render() {

    let b = 7;

/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/;
async () => {
 { svelteHTML.createElement("div", {});
     { __sveltets_createSlot("default", { "a":b,});  }
 }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {a:b}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}