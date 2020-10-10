///<reference types="svelte" />
<></>;function render() {
b.set(__sveltets_store_get(b).concat(5));const __svelte_store_get_values__ = {b:__sveltets_store_get(b),};

() => (<>
<h1 onclick={() => b.set(__svelte_store_get_values__['b'].concat(5))}>{__svelte_store_get_values__['b']}</h1></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}
