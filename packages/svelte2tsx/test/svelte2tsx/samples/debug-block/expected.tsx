///<reference types="svelte" />
<></>;function render() {
<>{myfile}
{(__sveltets_store_get(myfile), $myfile)}{someOtherFile}
{myfile}{(__sveltets_store_get(someOtherFile), $someOtherFile)}{someThirdFile}</>
return { props: {}, slots: {}, getters: {}, setters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}