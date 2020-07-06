<></>;function render() {

     let [a,b,c] = [1,2,3];
;
<></>
return { props: {a: a , b: b , c: c}, slots: {} }}

export default class Input {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
