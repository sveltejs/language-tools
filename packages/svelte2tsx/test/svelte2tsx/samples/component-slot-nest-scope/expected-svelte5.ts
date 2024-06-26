///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => {  for(let item of __sveltets_2_ensureArray(items)){
      for(let { a } of __sveltets_2_ensureArray(item)){
         { __sveltets_createSlot("default", {a,});  }
    }
      { __sveltets_createSlot("second", {  a,}); }
}
 { const $$_tnenopmoC0C = __sveltets_2_ensureComponent(Component); const $$_tnenopmoC0 = new $$_tnenopmoC0C({ target: __sveltets_2_any(), props: { children:() => { return __sveltets_2_any(0); },}});{const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,c,} = $$_tnenopmoC0.$$slot_def.default;$$_$$; c ; }Component}
   { const $$_value = await (promise);{ const d = $$_value; 
    d;
}}
 { __sveltets_createSlot("third", {   d,c,}); }};
return { props: /** @type {Record<string, never>} */ ({}), exports: {}, bindings: "", slots: {'default': {a:(({ a }) => a)(__sveltets_2_unwrapArr(__sveltets_2_unwrapArr(items)))}, 'second': {a:a}, 'third': {d:d, c:c}}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component_slots(__sveltets_2_partial(__sveltets_2_with_any_event(render())));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;