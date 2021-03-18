///<reference types="svelte" />
<></>;function render() {

  let  { count } = __sveltets_invalidate(() => (__sveltets_store_get(data), $data));
  let  { count2 } = __sveltets_invalidate(() => (__sveltets_store_get(data), $data))
  let count3;
  $: ({ count3 } = __sveltets_invalidate(() => (__sveltets_store_get(data), $data)))
  let bla4;
  let bla5;
$: ({ bla4, bla5 } = __sveltets_invalidate(() => (__sveltets_store_get(data), $data)))

  let  [ count ] = __sveltets_invalidate(() => (__sveltets_store_get(data), $data));
  let  [ count2 ] = __sveltets_invalidate(() => (__sveltets_store_get(data), $data))
  let count3;
  $: ([ count3 ] = __sveltets_invalidate(() => (__sveltets_store_get(data), $data)))
  let bla4;
  let bla5;
$: ([ bla4, bla5 ] = __sveltets_invalidate(() => (__sveltets_store_get(data), $data)))
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, setters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}