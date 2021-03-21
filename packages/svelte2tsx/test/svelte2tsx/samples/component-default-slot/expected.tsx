///<reference types="svelte" />
<></>;function render() {

    let b = 7;
;
() => (<>
<div>
    <slot a={b}>Hello</slot>
</div></>);
return { props: {}, slots: {'default': {a:b}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}