///<reference types="svelte" />
<></>;function render() {

     class Foo {};
;
() => (<></>);
return { props: {Foo: Foo}, slots: {}, getters: {Foo: Foo}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
    get Foo() { return render().getters.Foo }
}
