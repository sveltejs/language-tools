///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => {  { const $$_each = __sveltets_2_ensureArray(items); for(let items of $$_each){
     { __sveltets_createSlot("default", { "a":items,});  }
}}};
let $$implicit_children = __sveltets_2_snippet({a:__sveltets_2_unwrapArr(items)});
return { props: {children: $$implicit_children}, slots: {'default': {a:__sveltets_2_unwrapArr(items)}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['children'], __sveltets_2_with_any_event(render()))) {
}