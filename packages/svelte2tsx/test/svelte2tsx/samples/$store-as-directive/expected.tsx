///<reference types="svelte" />
<></>;function render() {

	const transitionStore = null/*Ωignore_startΩ*/;let $transitionStore = __sveltets_store_get(transitionStore);/*Ωignore_endΩ*/;
	const animateStore = null/*Ωignore_startΩ*/;let $animateStore = __sveltets_store_get(animateStore);/*Ωignore_endΩ*/;
	const inStore = null/*Ωignore_startΩ*/;let $inStore = __sveltets_store_get(inStore);/*Ωignore_endΩ*/;
	const outStore = null/*Ωignore_startΩ*/;let $outStore = __sveltets_store_get(outStore);/*Ωignore_endΩ*/;
	const actionStore = null/*Ωignore_startΩ*/;let $actionStore = __sveltets_store_get(actionStore);/*Ωignore_endΩ*/;
;
() => (<>

<div 
    {...__sveltets_ensureTransition((__sveltets_store_get(transitionStore), $transitionStore)(__sveltets_mapElementTag('div'),({ y: 100 })))}
    {...__sveltets_ensureAction((__sveltets_store_get(actionStore), $actionStore)(__sveltets_mapElementTag('div')))}
    {...__sveltets_ensureTransition((__sveltets_store_get(inStore), $inStore)(__sveltets_mapElementTag('div'),{}))}
    {...__sveltets_ensureTransition((__sveltets_store_get(outStore), $outStore)(__sveltets_mapElementTag('div'),{}))}
    {...__sveltets_ensureAnimation((__sveltets_store_get(animateStore), $animateStore)(__sveltets_mapElementTag('div'),__sveltets_AnimationMove,{}))}
>
</div></>);
return { props: {}, slots: {}, getters: {}, setters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}