///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => {  for(let item of __sveltets_2_ensureArray(items)){
     { __sveltets_createSlot("default", { "a":item,});  }
}
  for(let { a } of __sveltets_2_ensureArray(items2)){
     { __sveltets_createSlot("second", {  a,});  }
}};
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {a:__sveltets_2_unwrapArr(items)}, 'second': {a:(({ a }) => a)(__sveltets_2_unwrapArr(items2))}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}