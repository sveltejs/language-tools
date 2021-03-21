///<reference types="svelte" />
<></>;function render() { let $$slots = __sveltets_slotsType({'foo': '', 'dashed-name': '', 'default': ''});
<><h1>{$$slots.foo}</h1>
<h1>{$$slots['dashed-name']}</h1>

<slot name="foo" />
<slot name="dashed-name" />
<slot /></>
return { props: {}, slots: {'foo': {}, 'dashed-name': {}, 'default': {}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}