///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => {    { try { const $$_value = await (promise);{ const value = $$_value; 
     { __sveltets_createSlot("default", { "a":value,});  }
}} catch($$_e) { const err = __sveltets_2_any();
     { __sveltets_createSlot("err", {   "err":err,});  }
}}
   { const $$_value = await (promise2);{ const { b } = $$_value; 
     { __sveltets_createSlot("second", {   "a":b,});  }
}}};
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {a:__sveltets_2_unwrapPromiseLike(promise)}, 'err': {err:__sveltets_2_any({})}, 'second': {a:(({ b }) => b)(__sveltets_2_unwrapPromiseLike(promise2))}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}