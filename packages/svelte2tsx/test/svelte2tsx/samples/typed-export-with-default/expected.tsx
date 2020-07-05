<></>;function render() {

     let name: string | number = "world";name = __sveltets_any(name);
;
<></>
return { props: {name: name} as {name?: string | number}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
