///<reference types="svelte" />
;
    let module = true;
;;

import { imported } from './x';
  const hoistable1/*Ωignore_positionΩ*/ = ()/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
     { svelteHTML.createElement("div", {});  }
};return __sveltets_2_any(0)}; const hoistable2/*Ωignore_positionΩ*/ = (bar)/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
     { svelteHTML.createElement("div", {});bar; }
};return __sveltets_2_any(0)}; const hoistable3/*Ωignore_positionΩ*/ = (bar: string)/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
     { svelteHTML.createElement("div", {});bar; }
};return __sveltets_2_any(0)}; const hoistable4/*Ωignore_positionΩ*/ = (foo)/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
     { svelteHTML.createElement("div", {});foo; }
};return __sveltets_2_any(0)};  const hoistable5/*Ωignore_positionΩ*/ = ()/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
     { svelteHTML.createElement("button", { "onclick":e => e,});  }
};return __sveltets_2_any(0)};  const hoistable6/*Ωignore_positionΩ*/ = ()/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
     { svelteHTML.createElement("div", {});module; }
};return __sveltets_2_any(0)};  const hoistable7/*Ωignore_positionΩ*/ = ()/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
     { svelteHTML.createElement("div", {});imported; }
};return __sveltets_2_any(0)};function render() {
  const not_hoistable/*Ωignore_positionΩ*/ = ()/*Ωignore_startΩ*/: ReturnType<import('svelte').Snippet>/*Ωignore_endΩ*/ => { async ()/*Ωignore_positionΩ*/ => {
     { svelteHTML.createElement("div", {});foo; }
};return __sveltets_2_any(0)};
    
    let foo = true;
;
async () => {

















};
return { props: /** @type {Record<string, never>} */ ({}), exports: {}, bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_partial(__sveltets_2_with_any_event(render())));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;