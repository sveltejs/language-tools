///<reference types="svelte" />
;function render() { let $$slots = __sveltets_2_slotsType({'foo': '', 'dashed-name': '', 'default': ''});

    let name = $$slots.foo;
    let dashedName = $$slots['dashed-name'];

/*Ωignore_startΩ*/;const __sveltets_createSlot = __sveltets_2_createCreateSlot();/*Ωignore_endΩ*/;
async () => {

 { svelteHTML.createElement("h1", {});name; }
 { __sveltets_createSlot("foo", {  });}
 { __sveltets_createSlot("dashed-name", {  });}
 { __sveltets_createSlot("default", {});}};
return { props: {children: __sveltets_2_snippet}, slots: {'foo': {}, 'dashed-name': {}, 'default': {}}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['children'], __sveltets_2_with_any_event(render()))) {
}