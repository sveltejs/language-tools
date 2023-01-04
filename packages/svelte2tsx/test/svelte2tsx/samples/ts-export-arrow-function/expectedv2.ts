///<reference types="svelte" />
;function render() {

     let f = (a: number, b: number) => {
      let c = a + b;
      return c;
    }
;
async () => {};
return { props: {f: f} as {f?: typeof f}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
}