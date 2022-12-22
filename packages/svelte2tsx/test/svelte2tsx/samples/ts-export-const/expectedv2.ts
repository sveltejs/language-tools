///<reference types="svelte" />
;function render() {

     const name: string = "world";
     const SOME = 1, CONSTANT = 2;
;
async () => {};
return { props: {name: name , SOME: SOME , CONSTANT: CONSTANT} as {name?: string, SOME?: typeof SOME, CONSTANT?: typeof CONSTANT}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
    get name() { return __sveltets_2_nonNullable(this.$$prop_def.name) }
    get SOME() { return __sveltets_2_nonNullable(this.$$prop_def.SOME) }
    get CONSTANT() { return __sveltets_2_nonNullable(this.$$prop_def.CONSTANT) }
}