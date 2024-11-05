///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => { { __sveltets_createSlot("default", {}); { svelteHTML.createElement("div", {});  } }
 { __sveltets_createSlot("foo", {    bar,"baz":`boo`,});
     { svelteHTML.createElement("p", {});  }
 }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {}, 'foo': {bar:bar, baz:"boo"}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}