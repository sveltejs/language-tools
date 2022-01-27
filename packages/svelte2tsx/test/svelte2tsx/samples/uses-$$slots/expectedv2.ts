///<reference types="svelte" />
;function render() { let $$slots = __sveltets_1_slotsType({'foo': '', 'dashed-name': '', 'default': ''});
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => { { svelteHTML.createElement("h1", {});$$slots.foo; }
{ svelteHTML.createElement("h1", { });$$slots['dashed-name']; }

{ __sveltets_createSlot("foo", {   });}
{ __sveltets_createSlot("dashed-name", {   });}
{ __sveltets_createSlot("default", {  });}};
return { props: {}, slots: {'foo': {}, 'dashed-name': {}, 'default': {}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}