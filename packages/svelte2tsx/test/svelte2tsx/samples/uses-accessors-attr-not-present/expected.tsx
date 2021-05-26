///<reference types="svelte" />
<></>;function render() {

	 let foo: number = undefined;foo = __sveltets_any(foo);
	 const bar: string = ''
;
() => (<><svelteoptions />
</>);
return { props: {foo: foo , bar: bar}, slots: {}, getters: {bar: bar}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(['foo','bar'], __sveltets_with_any_event(render()))) {
    get bar() { return render().getters.bar }
}