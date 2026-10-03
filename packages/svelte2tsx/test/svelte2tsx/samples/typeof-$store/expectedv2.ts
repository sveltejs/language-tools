///<reference types="svelte" />
;
	import {writable} from "svelte/store";
function $$render() {

	const foo = writable(1)/*Ωignore_startΩ*/;let $foo = __sveltets_2_store_get(foo);/*Ωignore_endΩ*/;
	type Foo = typeof $foo;
;
async () => {};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event($$render()))) {
}