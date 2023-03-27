///<reference types="svelte" />
;function render() {

     let data/*Ωignore_startΩ*/: import('./$types.js').PageData;data = __sveltets_2_any(data);/*Ωignore_endΩ*/;
     let form/*Ωignore_startΩ*/: import('./$types.js').ActionData;form = __sveltets_2_any(form);/*Ωignore_endΩ*/;
     const snapshot/*Ωignore_startΩ*/: import('./$types.js').Snapshot/*Ωignore_endΩ*/ = {};

     let nope/*Ωignore_startΩ*/;nope = __sveltets_2_any(nope);/*Ωignore_endΩ*/;
     let form/*Ωignore_startΩ*/: import('./$types.js').ActionData/*Ωignore_endΩ*/ = {}
     let data: number/*Ωignore_startΩ*/;data = __sveltets_2_any(data);/*Ωignore_endΩ*/;
;
async () => {};
return { props: {data: data , form: form , snapshot: snapshot , nope: nope}, slots: {}, events: {} }}

export default class Page__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['form','snapshot'], __sveltets_2_with_any_event(render()))) {
    get snapshot() { return __sveltets_2_nonNullable(this.$$prop_def.snapshot) }
}