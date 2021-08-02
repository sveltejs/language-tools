///<reference types="svelte" />
<></>;function render() {

	 let foo: number = undefined;foo = __sveltets_1_any(foo);;
;
() => (<></>);
return { props: {foo: foo}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(['foo'], __sveltets_1_with_any_event(render()))) {
    get foo() { return render().props.foo }
    /**accessor*/
    set foo(_) {}
}