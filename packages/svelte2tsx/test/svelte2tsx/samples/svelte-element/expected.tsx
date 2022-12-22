///<reference types="svelte" />
<></>;function render() {

  let tag = 'div';
;
() => (<>

<svelteelement this={tag} />
<svelteelement this="tag" />
<svelteelement this={tag ? 'a' : 'b'} />
<svelteelement this={tag}>{tag}</svelteelement>
<svelteelement this={tag} onclick={() => tag} />
<svelteelement this={'a'} data-sveltekit-preload-data href="https://kit.svelte.dev" /></>);
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}