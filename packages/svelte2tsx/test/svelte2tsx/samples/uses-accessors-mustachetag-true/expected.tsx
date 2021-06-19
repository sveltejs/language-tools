///<reference types="svelte" />
<></>;function render() {

	 let foo: number = undefined;foo = __sveltets_any(foo);
	 let foo2 = undefined
	let clazz: string
	
	 const bar: string = ''
;
() => (<><svelteoptions accessors={true} />
</>);
return { props: {foo: foo , foo2: foo2 , class: clazz , bar: bar}, slots: {}, getters: {bar: bar}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(['foo','foo2','bar'], __sveltets_with_any_event(render()))) {
    get bar() { return render().getters.bar }
    get foo() { return render().props.foo }
    /**accessor*/
    set foo(_) {}
    get foo2() { return render().props.foo2 }
    /**accessor*/
    set foo2(_) {}
    get class() { return render().props.class }
    /**accessor*/
    set class(_) {}
}