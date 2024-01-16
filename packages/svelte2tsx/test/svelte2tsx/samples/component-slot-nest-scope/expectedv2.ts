///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => {  for(let item of __sveltets_2_ensureArray(items)){
      for(let { a } of __sveltets_2_ensureArray(item)){
         { __sveltets_createSlot("default", {a,});  }
    }
      { __sveltets_createSlot("second", {  a,}); }
}
 { const $$_tnenopmoC0C = __sveltets_2_ensureComponent(Component); const $$_tnenopmoC0 = new $$_tnenopmoC0C({ target: __sveltets_2_any(), props: { }});{const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,c,} = $$_tnenopmoC0.$$slot_def.default;$$_$$; c ; }Component}
   { const $$_value = await (promise);{ const d = $$_value; 
    d;
}}
 { __sveltets_createSlot("third", {   d,c,}); }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {a:(({ a }) => a)(__sveltets_2_unwrapArr(__sveltets_2_unwrapArr(items)))}, 'second': {a:a}, 'third': {d:d, c:c}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}