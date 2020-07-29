<></>;function render() {

    $: store.set( __sveltets_invalidate(() => __sveltets_store_get(store) + 1));
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
    $on = __sveltets_eventDef(render().events)
}
