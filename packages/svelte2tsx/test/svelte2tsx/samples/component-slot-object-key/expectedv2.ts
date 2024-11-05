///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => {  for(let item of __sveltets_2_ensureArray(items)){
     { __sveltets_createSlot("default", {             "a":item,"b":{ item },"c":{ item: 'abc' }.item,"d":{ item: item },"e":$item,"f":$item,...g,...item,});  }
}};
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {a:__sveltets_2_unwrapArr(items), b:{ item:__sveltets_2_unwrapArr(items) }, c:{ item: 'abc' }.item, d:{ item: __sveltets_2_unwrapArr(items) }, e:$item, f:$item, ...g, ...__sveltets_2_unwrapArr(items)}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}