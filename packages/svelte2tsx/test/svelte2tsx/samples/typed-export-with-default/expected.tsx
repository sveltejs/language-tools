<></>;function render() {

     let name: string = "world"
name = __sveltets_invalidateWithDefault(() => name);
;
<></>
return { props: {name: name} as {name: string}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
