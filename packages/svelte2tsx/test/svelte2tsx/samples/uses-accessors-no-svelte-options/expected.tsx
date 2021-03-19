///<reference types="svelte" />
<></>;function render() {

	 let foo: number = undefined;foo = __sveltets_any(foo);
	 const bar: string = ''
;
() => (<></>);
return { props: {foo: foo , bar: bar}, slots: {}, getters: {bar: bar}, setters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
    get bar() { return render().getters.bar }
}