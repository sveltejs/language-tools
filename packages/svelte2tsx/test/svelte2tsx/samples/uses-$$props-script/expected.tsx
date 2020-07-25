<></>;function render() { let $$props = __sveltets_allPropsType();

    let name = $$props['name'];
;
<><h1>{name}</h1>
</>
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial_with_any(render().props)
    $$slot_def = render().slots
    $on = __sveltets_eventDef(render().events).$on
}
