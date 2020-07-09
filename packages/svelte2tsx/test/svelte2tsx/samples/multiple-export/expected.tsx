<></>;function render() {

     let number1: number
     let number2: number
;
<>
<h1>{number1} + {number2} = {number1 + number2}</h1></>
return { props: {number1: number1 , number2: number2} as {number1: number, number2: number}, slots: {} }}

export default class Input__SvelteComponent_ {
    $$prop_def = __sveltets_partial(render().props)
    $$slot_def = render().slots
}
