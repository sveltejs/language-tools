///<reference types="svelte" />
<></>;function render() {
const __svelte_store_get_values__ = {check:__sveltets_store_get(check),};
<><Component  />{__sveltets_instanceOf(Component).$on('click', __svelte_store_get_values__['check'] ? method1 : method2)}
<button onclick={__svelte_store_get_values__['check'] ? method1 : method2} >Bla</button></>
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}
