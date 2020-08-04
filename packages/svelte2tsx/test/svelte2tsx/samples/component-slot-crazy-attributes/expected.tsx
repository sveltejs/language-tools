<></>;function render() {

    let b = 7;
;
() => (<>
<div>
    <slot a={b} b={b} c="b" d={`a${b}`} e={b} >Hello</slot>
</div></>);
return { props: {}, slots: {default: {a:b, b:b, c:"b", d:"__svelte_ts_string", e:b}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(render)) {
}
