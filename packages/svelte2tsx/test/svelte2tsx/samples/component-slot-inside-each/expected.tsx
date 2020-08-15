///<reference types="svelte" />
<></>;function render() {

    const items = [];
;
() => (<>

{__sveltets_each(items, (item) => <>
    <slot a={item}>Hello</slot>
</>)}</>);
return { props: {}, slots: {default: {a:_sveltets_unwrapArr(items)}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(render)) {
}
