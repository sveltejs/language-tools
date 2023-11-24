///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => {if(true){
 { const $$_svelteself0 = __sveltets_2_createComponentAny({ children:() => { return __sveltets_2_any(0); },});{const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,prop,} = $$_svelteself0.$$slot_def.default;$$_$$;
     { __sveltets_createSlot("default", { prop,});}
 }}
}
 { const $$_tnenopmoc_etlevs0C = __sveltets_2_ensureComponent(testComponent); const $$_tnenopmoc_etlevs0 = new $$_tnenopmoc_etlevs0C({ target: __sveltets_2_any(), props: {  children:() => { return __sveltets_2_any(0); },}});{const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,prop,} = $$_tnenopmoc_etlevs0.$$slot_def.default;$$_$$;
     { __sveltets_createSlot("default", { prop,});}
 }}};
let $$implicit_children = {prop:__sveltets_2_instanceOf(__sveltets_1_componentType()).$$slot_def['default'].prop};
return { props: {children: $$implicit_children}, slots: {'default': {prop:__sveltets_2_instanceOf(__sveltets_1_componentType()).$$slot_def['default'].prop}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['children'], __sveltets_2_with_any_event(render()))) {
}