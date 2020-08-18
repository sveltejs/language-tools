///<reference types="svelte" />
<></>;function render() {
<>{() => {let _$$p = (promise); __sveltets_awaitThen(_$$p, (value) => {<>
    <slot a={value}>Hello</slot>
</>}, (err) => {<>
    <slot name="err" err={err}>Hello</slot>
</>})}}
{() => {let _$$p = (promise2); __sveltets_awaitThen(_$$p, ({ b }) => {<>
    <slot name="second" a={b}>Hello</slot>
</>})}}</>
return { props: {}, slots: {default: {a:__sveltets_unwrapPromiseLike(promise)}, err: {err:__sveltets_any({})}, second: {a:(({ b }) => b)(__sveltets_unwrapPromiseLike(promise2))}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(render)) {
}
