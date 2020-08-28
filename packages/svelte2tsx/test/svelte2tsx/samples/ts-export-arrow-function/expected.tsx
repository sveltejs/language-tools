///<reference types="svelte" />
<></>;function render() {

     let f = (a: number, b: number) => {
      let c = a + b;
      return c;
    }
;
() => (<></>);
return { props: {f: f} as {f?: typeof f}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(__sveltets_with_any_event(render))) {
}
