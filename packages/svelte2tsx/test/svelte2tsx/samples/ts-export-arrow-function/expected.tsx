///<reference types="svelte" />
<></>;function render() {

     let f = (a: number, b: number) => {
      let c = a + b;
      return c;
    }
;
() => (<></>);
return { props: {f: f} as {f?: typeof f}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_with_any_event(render())) {
}