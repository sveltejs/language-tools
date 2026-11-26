///<reference types="svelte" />
;
    import { fade } from 'svelte/transition';
function $$render() {

    function three(_node: HTMLElement, _params: { delay: number }, _options: { direction: 'in' | 'out' | 'both' }) {
        return {};
    }
;
async () => {

 { svelteHTML.createElement("div", {      });__sveltets_2_ensureTransition(three(svelteHTML.mapElementTag('div'),({ delay: 1 }), ...__sveltets_2_transitionRest(/*Ωignore_startΩ*/three/*Ωignore_endΩ*/)));__sveltets_2_ensureTransition(fade(svelteHTML.mapElementTag('div'), ...__sveltets_2_transitionRest(/*Ωignore_startΩ*/fade/*Ωignore_endΩ*/)));__sveltets_2_ensureTransition(fade(svelteHTML.mapElementTag('div'),({ duration: 1 }), ...__sveltets_2_transitionRest(/*Ωignore_startΩ*/fade/*Ωignore_endΩ*/)));}};
return { props: {} as Record<string, never>, exports: {}, bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_with_any_event($$render()));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;