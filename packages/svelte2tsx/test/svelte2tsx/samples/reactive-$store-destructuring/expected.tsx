<></>;function render() {

  let  {bla} = __sveltets_invalidate(() => blubb);
  let  {bla2} = __sveltets_invalidate(() => blubb)
  let bla3;
  $: ({ bla3 } = __sveltets_invalidate(() => blubb))

  let  { count } = __sveltets_invalidate(() => __sveltets_store_get(data));
  let  { count2 } = __sveltets_invalidate(() => __sveltets_store_get(data))
  let count3;
  $: ({ count3 } = __sveltets_invalidate(() => __sveltets_store_get(data)))
;
() => (<></>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(render)) {
}