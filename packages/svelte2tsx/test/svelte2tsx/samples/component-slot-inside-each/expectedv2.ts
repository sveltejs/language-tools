///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => {  for(const item of __sveltets_2_ensureArray(items)){
    { __sveltets_createSlot("default", {   "a":item,});  }
}
  for(const { a } of __sveltets_2_ensureArray(items2)){
    { __sveltets_createSlot("second", {   a,});  }
}};
return { props: {}, slots: {'default': {a:__sveltets_1_unwrapArr(items)}, 'second': {a:(({ a }) => a)(__sveltets_1_unwrapArr(items2))}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}