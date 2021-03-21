///<reference types="svelte" />
<></>;function render() {
<>{__sveltets_each(items, (item) => <>
    {__sveltets_each(item, ({ a }) => <>
        <slot a={a}>Hello</slot>
    </>)}
    <slot name="second" a={ a }></slot>
</>)}
<Component >{() => { let {c} = __sveltets_instanceOf(Component).$$slot_def['default'];<>{ c }</>}}</Component>
{() => {let _$$p = (promise); __sveltets_awaitThen(_$$p, (d) => {<>
    {d}
</>})}}
<slot name="third" d={d} c={c}></slot></>
return { props: {}, slots: {'default': {a:(({ a }) => a)(__sveltets_unwrapArr(__sveltets_unwrapArr(items)))}, 'second': {a:a}, 'third': {d:d, c:c}}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}