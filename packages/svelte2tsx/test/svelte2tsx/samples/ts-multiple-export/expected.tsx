///<reference types="svelte" />
<></>;function render() {

     let number1: number/*Ωignore_startΩ*/;number1 = __sveltets_1_any(number1);/*Ωignore_endΩ*/
     let number2: number/*Ωignore_startΩ*/;number2 = __sveltets_1_any(number2);/*Ωignore_endΩ*/
;
() => (<>
<h1>{number1} + {number2} = {number1 + number2}</h1></>);
return { props: {number1: number1 , number2: number2} as {number1: number, number2: number}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_with_any_event(render())) {
}