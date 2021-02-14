///<reference types="svelte" />
<></>;function render() {
<>{myfile}
{__sveltets_store_get(myfile)}{someOtherFile}
{myfile}{__sveltets_store_get(someOtherFile)}{someThirdFile}</>
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}