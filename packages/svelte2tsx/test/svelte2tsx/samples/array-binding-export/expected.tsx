<></>;function render() {

     let [a,b,c] = [1,2,3];
;
<></>
return { props: {a , b , c} as {a: typeof a, b: typeof b, c: typeof c}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
