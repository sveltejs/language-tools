///<reference types="svelte" />
<></>;
 export async function preload(page, session) {
         const res = await __sapperPreloadGlobals.fetch(`blog/${slug}.json`);
        __sapperPreloadGlobals.error(500, 'OUCH');
        return await __sapperPreloadGlobals.redirect(404, 'notfound');
 }
;<></>;function render() {
<></>
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}