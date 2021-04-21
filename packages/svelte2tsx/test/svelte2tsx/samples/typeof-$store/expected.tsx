///<reference types="svelte" />
<></>;
import {writable} from "svelte/store";
function render() {

	
	const foo = writable(1)/*Ωignore_startΩ*/;let $foo = __sveltets_store_get(foo);/*Ωignore_endΩ*/;
	type Foo = typeof $foo;
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}