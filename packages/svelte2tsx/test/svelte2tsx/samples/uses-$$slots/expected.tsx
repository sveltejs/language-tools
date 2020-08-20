///<reference types="svelte" />
<></>;function render() { let $$slots: { foo: any, default: any } = __sveltets_slotsType();
<><h1>{$$slots['name']}</h1>

<slot name="foo" />
<slot /></>
return { props: {}, slots: {foo: {}, default: {}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}