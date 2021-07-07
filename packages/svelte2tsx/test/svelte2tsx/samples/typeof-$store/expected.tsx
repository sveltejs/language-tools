///<reference types="svelte" />
<></>;
import {writable} from "svelte/store";
function render() {

	
	const foo = writable(1)/*Ωignore_startΩ*/;let $foo = __sveltets_1_store_get(foo);/*Ωignore_endΩ*/;
	type Foo = typeof $foo;
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}