<></>;function render() {

    let b = 7;
    let d = 5;
    let e = 5;
;
() => (<>
<div>
    <slot a={b}>Hello</slot>
    <slot name="test" c={d} e={e}></slot>
</div></>);
return { props: {}, slots: {default: {a:b}, test: {c:d, e:e}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(render)) {
}
