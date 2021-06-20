///<reference types="svelte" />
<></>;
import storeA from './store';
import { storeB } from './store';
import { storeB as storeC } from './store';
function render() {
/*Ωignore_startΩ*/;let $storeA = __sveltets_1_store_get(storeA);;let $storeB = __sveltets_1_store_get(storeB);;let $storeC = __sveltets_1_store_get(storeC);/*Ωignore_endΩ*/
    
    
    
;
() => (<>

<p>{(__sveltets_1_store_get(storeA), $storeA)}</p>
<p>{(__sveltets_1_store_get(storeB), $storeB)}</p>
<p>{(__sveltets_1_store_get(storeC), $storeC)}</p></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}