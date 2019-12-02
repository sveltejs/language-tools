<></>;function render() {
<><input id="dom-input" type="radio" {...__sveltets_any(__sveltets_store_get(compile_options).generate)} value="dom"/></>
return { props: {}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
