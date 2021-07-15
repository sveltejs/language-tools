///<reference types="svelte" />
<></>;
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

    const dispatch = createEventDispatcher<__sveltets_1_CustomEvents<$$Events>>();
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} as unknown as $$Events }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(render())) {
}