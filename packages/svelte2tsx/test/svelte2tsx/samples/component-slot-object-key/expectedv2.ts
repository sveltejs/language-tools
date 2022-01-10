///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => {  for(const item of __sveltets_2_ensureArray(items)){
                 { __sveltets_createSlot("default", {"a":item,"b":{ item },"c":{ item: 'abc' }.item,"d":{ item: item },"e":(__sveltets_1_store_get(item), $item),"f":(__sveltets_1_store_get(item), $item),});  }
}};
return { props: {}, slots: {'default': {a:__sveltets_1_unwrapArr(items), b:{ item:__sveltets_1_unwrapArr(items) }, c:{ item: 'abc' }.item, d:{ item: __sveltets_1_unwrapArr(items) }, e:$item, f:$item, ...g, ...__sveltets_1_unwrapArr(items)}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}