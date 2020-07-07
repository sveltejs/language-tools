<></>;
    export function preload() {}
    let b = 5;
;<></>;function render() {

     let world = "name"
;
<>
<h1>hello {world}</h1>
</>
return { props: {world: world}, slots: {} }}

export default class Input {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}