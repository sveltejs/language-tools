<></>;function render() {

     let name: string = "world",
        world: string = ''
name = __sveltets_invalidate(() => name);
world = __sveltets_invalidate(() => world);
;
<></>
return { props: {name: name , world: world} as {name: string, world: string}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
