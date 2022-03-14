///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => { { const $$_Component0C = __sveltets_2_ensureComponent(Component); const $$_Component0 = new $$_Component0C({ target: __sveltets_2_any(), props: {     }});{const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,name:n,thing,whatever:{ bla },} = $$_Component0.$$slot_def.default;$$_$$;
     { __sveltets_createSlot("default", {   n,thing,bla,});}
 }Component}};
return { props: {}, slots: {'default': {n:__sveltets_1_instanceOf(Component).$$slot_def['default'].name, thing:__sveltets_1_instanceOf(Component).$$slot_def['default'].thing, bla:(({ bla }) => bla)(__sveltets_1_instanceOf(Component).$$slot_def['default'].whatever)}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}