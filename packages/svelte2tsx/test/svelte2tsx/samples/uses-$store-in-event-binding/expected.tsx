<></>;function render() {
<><Component {...__sveltets_ensureFunction((__sveltets_store_get(check) ? method1 : method2))} />
<button onclick={__sveltets_store_get(check) ? method1 : method2} >Bla</button></>
return { props: {}, slots: {}, getters: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
