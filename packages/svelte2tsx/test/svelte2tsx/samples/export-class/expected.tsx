<></>;function render() {

     class Foo {};
;
<></>
return { props: {}, slots: {}, getters: {Foo: Foo}, events: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
    get Foo() { return render().getters.Foo }
    $on = __sveltets_eventDef(render().events).$on
}
