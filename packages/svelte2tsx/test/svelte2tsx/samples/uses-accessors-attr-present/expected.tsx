///<reference types="svelte" />
<></>;function render() {

	 let foo: number = undefined;foo = __sveltets_any(foo);
	 let foo2 = undefined
	 const bar: string = ''
;
() => (<><svelteoptions accessors />
</>);
return { props: {foo: foo , foo2: foo2 , bar: bar}, slots: {}, getters: {bar: bar, foo: foo, foo2: foo2}, setters: {foo: foo, foo2: foo2}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
    get bar() { return render().getters.bar }
    get foo() { return render().getters.foo }
    get foo2() { return render().getters.foo2 }
    /**accessor*/
    set foo(foo) {}
    /**accessor*/
    set foo2(foo2) {}
}