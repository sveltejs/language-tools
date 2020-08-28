///<reference types="svelte" />
<></>;function render() {

  let  { count } = __sveltets_invalidate(() => __sveltets_store_get(data));
  let  { count2 } = __sveltets_invalidate(() => __sveltets_store_get(data))
  let count3;
  $: ({ count3 } = __sveltets_invalidate(() => __sveltets_store_get(data)))
  let bla4;
  let bla5;
$: ({ bla4, bla5 } = __sveltets_invalidate(() => __sveltets_store_get(data)))

  let  [ count ] = __sveltets_invalidate(() => __sveltets_store_get(data));
  let  [ count2 ] = __sveltets_invalidate(() => __sveltets_store_get(data))
  let count3;
  $: ([ count3 ] = __sveltets_invalidate(() => __sveltets_store_get(data)))
  let bla4;
  let bla5;
$: ([ bla4, bla5 ] = __sveltets_invalidate(() => __sveltets_store_get(data)))
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}