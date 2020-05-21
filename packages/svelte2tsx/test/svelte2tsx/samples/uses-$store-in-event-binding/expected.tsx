<></>;function render() {
<><Component {...__sveltets_ensureFunction((__sveltets_store_get(check) ? method1 : method2))} />
<button onclick={__sveltets_store_get(check) ? method1 : method2} >Bla</button></>
return { props: {}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}