///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<>{() => {let _$$p = (promise); __sveltets_1_awaitThen(_$$p, (value) => {<>
    <slot a={__sveltets_ensureSlot("default","a",value)}>Hello</slot>
</>}, (err) => {<>
    <slot name="err" err={__sveltets_ensureSlot("err","err",err)}>Hello</slot>
</>})}}
{() => {let _$$p = (promise2); __sveltets_1_awaitThen(_$$p, ({ b }) => {<>
    <slot name="second" a={__sveltets_ensureSlot("second","a",b)}>Hello</slot>
</>})}}</>
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {a:__sveltets_2_unwrapPromiseLike(promise)}, 'err': {err:__sveltets_2_any({})}, 'second': {a:(({ b }) => b)(__sveltets_2_unwrapPromiseLike(promise2))}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}