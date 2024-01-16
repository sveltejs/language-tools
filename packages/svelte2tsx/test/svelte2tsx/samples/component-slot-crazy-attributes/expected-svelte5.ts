///<reference types="svelte" />
;function render() {

    let b = 7;

/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/;
async () => {
 { svelteHTML.createElement("div", {});
     { __sveltets_createSlot("default", {       "a":b,b,"c":`b`,"d":`a${b}`,"e":b,});  }
 }};
let $$implicit_children = __sveltets_2_snippet({a:b, b:b, c:"b", d:"__svelte_ts_string", e:b});
return { props: {children: $$implicit_children}, slots: {'default': {a:b, b:b, c:"b", d:"__svelte_ts_string", e:b}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['children'], __sveltets_2_with_any_event(render()))) {
}