///<reference types="svelte" />
;function render() {
/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/
async () => { { const $$_tnenopmoC0C = __sveltets_2_ensureComponent(Component); const $$_tnenopmoC0 = new $$_tnenopmoC0C({ target: __sveltets_2_any(), props: {     children:() => { return __sveltets_2_any(0); },}});{const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,name:n,thing,whatever:{ bla },} = $$_tnenopmoC0.$$slot_def.default;$$_$$;
     { __sveltets_createSlot("default", {   n,thing,bla,});}
 }Component}};
let $$implicit_children = {n:__sveltets_2_instanceOf(Component).$$slot_def['default'].name, thing:__sveltets_2_instanceOf(Component).$$slot_def['default'].thing, bla:(({ bla }) => bla)(__sveltets_2_instanceOf(Component).$$slot_def['default'].whatever)};
return { props: {children: $$implicit_children}, slots: {'default': {n:__sveltets_2_instanceOf(Component).$$slot_def['default'].name, thing:__sveltets_2_instanceOf(Component).$$slot_def['default'].thing, bla:(({ bla }) => bla)(__sveltets_2_instanceOf(Component).$$slot_def['default'].whatever)}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['children'], __sveltets_2_with_any_event(render()))) {
}