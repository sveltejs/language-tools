///<reference types="svelte" />
;function render() {

	const config = { branding: { primaryColor: '#012345' } },
		branding = config?.branding;

	const cssString = `<style>:root {--primary-color: ${
		branding?.primaryColor ?? '#ABCDEF'
	};}</style>`;
;
async () => {};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}