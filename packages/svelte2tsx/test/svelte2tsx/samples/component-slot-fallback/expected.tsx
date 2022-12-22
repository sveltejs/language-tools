///<reference types="svelte" />
<></>;function render() {
/*Ωignore_startΩ*/;const __sveltets_ensureSlot = __sveltets_1_createEnsureSlot();/*Ωignore_endΩ*/
<><slot><div>fallback content</div></slot>
<slot name="foo" bar={__sveltets_ensureSlot("foo","bar",bar)} baz={__sveltets_ensureSlot("foo","baz","boo")}>
    <p>fallback</p>
</slot></>
return { props: /** @type {Record<string, never>} */ ({}), slots: {'default': {}, 'foo': {bar:bar, baz:"boo"}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}