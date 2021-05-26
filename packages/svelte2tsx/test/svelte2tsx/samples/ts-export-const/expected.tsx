///<reference types="svelte" />
<></>;function render() {

     const name: string = "world";
     const SOME = 1, CONSTANT = 2;
;
() => (<></>);
return { props: {name: name , SOME: SOME , CONSTANT: CONSTANT} as {name?: string, SOME?: typeof SOME, CONSTANT?: typeof CONSTANT}, slots: {}, getters: {name: name, SOME: SOME, CONSTANT: CONSTANT}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_with_any_event(render())) {
    get name() { return render().getters.name }
    get SOME() { return render().getters.SOME }
    get CONSTANT() { return render().getters.CONSTANT }
}