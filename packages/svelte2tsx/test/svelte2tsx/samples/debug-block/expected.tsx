///<reference types="svelte" />
<></>;function render() {
<>{myfile}
{(__sveltets_1_store_get(myfile), $myfile)}{someOtherFile}
{myfile}{(__sveltets_1_store_get(someOtherFile), $someOtherFile)}{someThirdFile}</>
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}