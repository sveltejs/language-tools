///<reference types="svelte" />
<></>;function render() {
$b=$b.concat(5);
() => (<>
<h1 onclick={() => $b=$b.concat(5)}>{$b}</h1></>);
return { props: {}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}