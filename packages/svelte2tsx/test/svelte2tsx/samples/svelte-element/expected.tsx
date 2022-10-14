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
<svelteelement this={'a'} data-sveltekit-prefetch href="https://kit.svelte.dev" /></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}
