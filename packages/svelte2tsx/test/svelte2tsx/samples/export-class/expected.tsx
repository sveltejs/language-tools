///<reference types="svelte" />
<></>;function render() {

     class Foo {};
;
() => (<></>);
return { props: {Foo: Foo}, slots: {}, getters: {Foo: Foo}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(['Foo'], __sveltets_1_with_any_event(render()))) {
    get Foo() { return render().getters.Foo }
}