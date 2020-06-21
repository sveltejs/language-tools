<></>;function render() {

     let f = (a: number, b: number) => {
      let c = a + b;
      return c;
    }
;
<></>
return { props: {f: f}, slots: {} }}

export default class {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
