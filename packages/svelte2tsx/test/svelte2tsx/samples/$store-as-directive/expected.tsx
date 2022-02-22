///<reference types="svelte" />
<></>;function render() {

	const transitionStore = null/*Ωignore_startΩ*/;let $transitionStore = __sveltets_1_store_get(transitionStore);/*Ωignore_endΩ*/;
	const animateStore = null/*Ωignore_startΩ*/;let $animateStore = __sveltets_1_store_get(animateStore);/*Ωignore_endΩ*/;
	const inStore = null/*Ωignore_startΩ*/;let $inStore = __sveltets_1_store_get(inStore);/*Ωignore_endΩ*/;
	const outStore = null/*Ωignore_startΩ*/;let $outStore = __sveltets_1_store_get(outStore);/*Ωignore_endΩ*/;
	const actionStore = null/*Ωignore_startΩ*/;let $actionStore = __sveltets_1_store_get(actionStore);/*Ωignore_endΩ*/;
;
() => (<>

<div 
    {...__sveltets_1_ensureTransition((__sveltets_1_store_get(transitionStore), $transitionStore)(__sveltets_1_mapElementTag('div'),({ y: 100 })))}
    {...__sveltets_1_ensureAction((__sveltets_1_store_get(actionStore), $actionStore)(__sveltets_1_mapElementTag('div')))}
    {...__sveltets_1_ensureTransition((__sveltets_1_store_get(inStore), $inStore)(__sveltets_1_mapElementTag('div'),{}))}
    {...__sveltets_1_ensureTransition((__sveltets_1_store_get(outStore), $outStore)(__sveltets_1_mapElementTag('div'),{}))}
    {...__sveltets_1_ensureAnimation((__sveltets_1_store_get(animateStore), $animateStore)(__sveltets_1_mapElementTag('div'),__sveltets_1_AnimationMove,{}))}
>
</div></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}