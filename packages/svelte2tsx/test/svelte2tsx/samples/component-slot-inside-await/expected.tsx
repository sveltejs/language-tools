///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_createEnsureSlot();/*Ωignore_endΩ*/
<>{() => {let _$$p = (promise); __sveltets_awaitThen(_$$p, (value) => {<>
    <slot a={__sveltets_ensureSlot("default","a",value)}>Hello</slot>
</>}, (err) => {<>
    <slot name="err" err={__sveltets_ensureSlot("err","err",err)}>Hello</slot>
</>})}}
{() => {let _$$p = (promise2); __sveltets_awaitThen(_$$p, ({ b }) => {<>
    <slot name="second" a={__sveltets_ensureSlot("second","a",b)}>Hello</slot>
</>})}}</>
return { props: {}, slots: {'default': {a:__sveltets_unwrapPromiseLike(promise)}, 'err': {err:__sveltets_any({})}, 'second': {a:(({ b }) => b)(__sveltets_unwrapPromiseLike(promise2))}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render()))) {
}