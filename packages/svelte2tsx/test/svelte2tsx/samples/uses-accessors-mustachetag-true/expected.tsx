///<reference types="svelte" />
<></>;function render() {

	 let foo: number = undefined;foo = __sveltets_any(foo);
	 const bar: string = ''
;
() => (<><svelteoptions accessors={true} />
</>);
return { props: {foo: foo , bar: bar}, slots: {}, getters: {foo: foo, bar: bar}, setters: {foo: foo}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
    get foo() { return render().getters.foo }
    get bar() { return render().getters.bar }

    /**accessor*/
    set foo(foo) {}
}