///<reference types="svelte" />
;function render() {

	const transitionStore = null/*Ωignore_startΩ*/;let $transitionStore = __sveltets_2_store_get(transitionStore);/*Ωignore_endΩ*/;
	const animateStore = null/*Ωignore_startΩ*/;let $animateStore = __sveltets_2_store_get(animateStore);/*Ωignore_endΩ*/;
	const inStore = null/*Ωignore_startΩ*/;let $inStore = __sveltets_2_store_get(inStore);/*Ωignore_endΩ*/;
	const outStore = null/*Ωignore_startΩ*/;let $outStore = __sveltets_2_store_get(outStore);/*Ωignore_endΩ*/;
	const actionStore = null/*Ωignore_startΩ*/;let $actionStore = __sveltets_2_store_get(actionStore);/*Ωignore_endΩ*/;
;
async () => {

 {const $$action_0 = __sveltets_2_ensureAction($actionStore(svelteHTML.mapElementTag('div')));{ svelteHTML.createElement("div", __sveltets_2_union($$action_0), {      });__sveltets_2_ensureTransition($transitionStore(svelteHTML.mapElementTag('div'),({ y: 100 })));__sveltets_2_ensureTransition($inStore(svelteHTML.mapElementTag('div')));__sveltets_2_ensureTransition($outStore(svelteHTML.mapElementTag('div')));__sveltets_2_ensureAnimation($animateStore(svelteHTML.mapElementTag('div'),__sveltets_2_AnimationMove));
 }}};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}