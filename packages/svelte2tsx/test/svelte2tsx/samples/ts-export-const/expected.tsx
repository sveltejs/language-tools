<></>;function render() {

     const name: string = "world";
     const SOME = 1, CONSTANT = 2;
;
() => (<></>);
return { props: {}, slots: {}, getters: {name: name, SOME: SOME, CONSTANT: CONSTANT}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(render)) {
    get name() { return render().getters.name }
    get SOME() { return render().getters.SOME }
    get CONSTANT() { return render().getters.CONSTANT }
}
