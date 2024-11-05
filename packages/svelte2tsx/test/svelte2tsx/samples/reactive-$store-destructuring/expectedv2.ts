///<reference types="svelte" />
;function render() {

  let  { count } = __sveltets_2_invalidate(() => $data);
  let  { count2 } = __sveltets_2_invalidate(() => $data)
  let count3;
  $: ({ count3 } = __sveltets_2_invalidate(() => $data))
  let bla4;
  let bla5;
$: ({ bla4, bla5 } = __sveltets_2_invalidate(() => $data))

  let  [ count ] = __sveltets_2_invalidate(() => $data);
  let  [ count2 ] = __sveltets_2_invalidate(() => $data)
  let count3;
  $: ([ count3 ] = __sveltets_2_invalidate(() => $data))
  let bla4;
  let bla5;
$: ([ bla4, bla5 ] = __sveltets_2_invalidate(() => $data))
;
async () => {};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}