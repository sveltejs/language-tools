<></>;function render() {
b.set(__sveltets_store_get(b).concat(5));
<>
<h1 onclick={() => b.set(__sveltets_store_get(b).concat(5))}>{__sveltets_store_get(b)}</h1></>
return { props: {}, slots: {} }}

export default class input {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}