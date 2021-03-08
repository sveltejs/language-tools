///<reference types="svelte" />
<></>;
import storeA from './store';
import { storeB } from './store';
import { storeB as storeC } from './store';
function render() {

    ;let $storeA = __sveltets_store_get(storeA);
    ;let $storeB = __sveltets_store_get(storeB);
    ;let $storeC = __sveltets_store_get(storeC);
;
() => (<>

<p>{(__sveltets_store_get(storeA), $storeA)}</p>
<p>{(__sveltets_store_get(storeB), $storeB)}</p>
<p>{(__sveltets_store_get(storeC), $storeC)}</p></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}