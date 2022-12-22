///<reference types="svelte" />
;
import { createEventDispatcher } from 'svelte';
function render() {

    

    interface $$Events {
        /**
         * Some *doc*
         */
        a: boolean;
        b: string;
        c;
    }

    const dispatch = createEventDispatcher<__sveltets_2_CustomEvents<$$Events>>();
;
async () => {};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} as unknown as $$Events }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(render())) {
}