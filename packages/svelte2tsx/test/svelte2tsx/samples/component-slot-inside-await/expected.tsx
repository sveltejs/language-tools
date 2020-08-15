///<reference types="svelte" />
<></>;function render() {

    const promise = Promise.resolve();
;
() => (<>

{() => {let _$$p = (promise); __sveltets_awaitThen(_$$p, (value) => {<>
    <slot a={value}>Hello</slot>
</>})}}</>);
return { props: {}, slots: {default: {a:__sveltets_unwrapPromiseLike(promise)}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(render)) {
}
