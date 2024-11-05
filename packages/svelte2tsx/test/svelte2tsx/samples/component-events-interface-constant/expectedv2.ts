///<reference types="svelte" />
;function render() {

    const A = 'a';
    const B = 'b', C = 'c';
    interface $$Events {
        /**
         * Some doc
         */
        [A]: boolean;
        [B]: string;
        [C];
    }
;
async () => {};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} as unknown as $$Events }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(render())) {
}