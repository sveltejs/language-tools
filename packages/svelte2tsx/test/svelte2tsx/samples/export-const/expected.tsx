<></>;function render() {

     const name: string = "world";
     const SOME = 1, CONSTANT = 2;
;
<></>
return { props: {}, slots: {}, getters: {name: name, SOME: SOME, CONSTANT: CONSTANT} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
    get name() { return render().getters.name }
    get SOME() { return render().getters.SOME }
    get CONSTANT() { return render().getters.CONSTANT }
}
