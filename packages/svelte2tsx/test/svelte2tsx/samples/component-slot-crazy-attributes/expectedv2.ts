///<reference types="svelte" />
;function render() {

    let b = 7;

/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/;
async () => {
 { svelteHTML.createElement("div", {});
     { __sveltets_createSlot("default", {       "a":b,b,"c":`b`,"d":`a${b}`,"e":b,});  }
 }};
return { props: {}, slots: {'default': {a:b, b:b, c:"b", d:"__svelte_ts_string", e:b}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}