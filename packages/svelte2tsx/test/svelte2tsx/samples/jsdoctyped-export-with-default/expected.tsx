<></>;function render() {

    /**@type { string | number }*/
     let name = "world",
        world = ''
name = __sveltets_invalidateWithDefault(() => name);;
;
<></>
return { props: {name: name , world: world}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
