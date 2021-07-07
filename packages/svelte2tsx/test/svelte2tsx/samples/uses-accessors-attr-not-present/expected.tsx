///<reference types="svelte" />
<></>;function render() {

	 let foo: number = undefined;foo = __sveltets_1_any(foo);
	 const bar: string = ''
;
() => (<><svelteoptions />
</>);
return { props: {foo: foo , bar: bar}, slots: {}, getters: {bar: bar}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(['foo','bar'], __sveltets_1_with_any_event(render()))) {
    get bar() { return render().getters.bar }
}