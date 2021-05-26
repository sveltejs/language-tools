///<reference types="svelte" />
<></>;function render() {

     let number1: number
     let number2: number
;
() => (<>
<h1>{number1} + {number2} = {number1 + number2}</h1></>);
return { props: {number1: number1 , number2: number2} as {number1: number, number2: number}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_with_any_event(render)) {
}