///<reference types="svelte" />
;function $$render() {

    let n = 1;
;
async () => {

 { svelteHTML.createElement("button", {        "on:click":() => n++,"class":`a`,"title":`x`,});svelteHTML.createElement("button", {"on:click":(e) => e.button,});  }
 { svelteHTML.createElement("svelte:window", {     "on:keydown":(e) => e.key,});svelteHTML.createElement("svelte:window", {"on:keydown":(e) => e.code,});}
 { svelteHTML.createElement("p", {  "on:click":undefined,});svelteHTML.createElement("p", {"on:click":undefined,}); }};
return { props: {} as Record<string, never>, exports: {}, bindings: "", slots: {}, events: {'click':__sveltets_2_mapElementEvent('click')} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_with_any_event($$render()));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;