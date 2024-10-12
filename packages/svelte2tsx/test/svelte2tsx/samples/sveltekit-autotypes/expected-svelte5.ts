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
return { props: {data: data , form: form , snapshot: snapshot , nope: nope}, exports: /** @type {{snapshot: typeof snapshot}} */ ({}), bindings: "", slots: {}, events: {} }}
const Page__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_partial(['form','snapshot'], __sveltets_2_with_any_event(render())));
/*Ωignore_startΩ*/type Page__SvelteComponent_ = InstanceType<typeof Page__SvelteComponent_>;
/*Ωignore_endΩ*/export default Page__SvelteComponent_;