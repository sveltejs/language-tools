///<reference types="svelte" />
;function $$render() {

    let n: number = 1;
;
async () => {

/* @ts-expect-error */
 { svelteHTML.createElement("input", {  "value":n.notThere,});}
/* @ts-expect-error */
 { svelteHTML.createElement("input", {  "value":n,});}
/* @ts-ignore */
 { svelteHTML.createElement("input", {  "value":n.alsoNotThere,});}

 { svelteHTML.createElement("input", {  "value":n.reported,});}};
return { props: {} as Record<string, never>, exports: {}, bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_with_any_event($$render()));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;