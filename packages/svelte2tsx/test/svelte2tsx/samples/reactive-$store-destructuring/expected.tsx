///<reference types="svelte" />
<></>;function render() {

  let  { count } = __sveltets_1_invalidate(() => $data);
  let  { count2 } = __sveltets_1_invalidate(() => $data)
  let count3;
  $: ({ count3 } = __sveltets_1_invalidate(() => $data))
  let bla4;
  let bla5;
$: ({ bla4, bla5 } = __sveltets_1_invalidate(() => $data))

  let  [ count ] = __sveltets_1_invalidate(() => $data);
  let  [ count2 ] = __sveltets_1_invalidate(() => $data)
  let count3;
  $: ([ count3 ] = __sveltets_1_invalidate(() => $data))
  let bla4;
  let bla5;
$: ([ bla4, bla5 ] = __sveltets_1_invalidate(() => $data))
;
() => (<></>);
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}