<></>;function render() {
b.set(__sveltets_store_get(b).concat(5));
<>
<h1>{__sveltets_store_get(b)}</h1></>
return { props: {}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}