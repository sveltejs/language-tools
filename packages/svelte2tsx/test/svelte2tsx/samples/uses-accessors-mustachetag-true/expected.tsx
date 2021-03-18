///<reference types="svelte" />
<></>;function render() {

	 let foo: number = undefined;foo = __sveltets_any(foo);
;
() => (<><svelteoptions accessors={true} />
</>);
return { props: {foo: foo}, slots: {}, getters: {foo: foo}, setters: {foo: foo}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
    get foo() { return render().getters.foo }

    /**accessor*/
    set foo(foo)
}