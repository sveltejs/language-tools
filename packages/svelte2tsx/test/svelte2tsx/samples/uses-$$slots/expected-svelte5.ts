///<reference types="svelte" />
;function render() { let $$slots = __sveltets_2_slotsType({'foo': '', 'dashed-name': '', 'default': ''});
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => { { svelteHTML.createElement("h1", {});$$slots.foo; }
 { svelteHTML.createElement("h1", {});$$slots['dashed-name']; }

 { __sveltets_createSlot("foo", {  });}
 { __sveltets_createSlot("dashed-name", {  });}
 { __sveltets_createSlot("default", {});}};
return { props: /** @type {Record<string, never>} */ ({}), slots: {'foo': {}, 'dashed-name': {}, 'default': {}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}