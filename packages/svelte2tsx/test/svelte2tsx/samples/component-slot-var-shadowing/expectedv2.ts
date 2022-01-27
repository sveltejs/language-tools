///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => {  { const $$_each = __sveltets_2_ensureArray(items); for(const items of $$_each){
    { __sveltets_createSlot("default", {   "a":items,});  }
}}};
return { props: {}, slots: {'default': {a:__sveltets_1_unwrapArr(items)}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}