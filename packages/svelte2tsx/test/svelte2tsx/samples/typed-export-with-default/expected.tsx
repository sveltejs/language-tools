<></>;function render() {

     let name: string | number = "world";name = __sveltets_any(name);
;
<></>
return { props: {name: name} as {name?: string | number}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
    $on = __sveltets_eventDef(render().events).$on
}
