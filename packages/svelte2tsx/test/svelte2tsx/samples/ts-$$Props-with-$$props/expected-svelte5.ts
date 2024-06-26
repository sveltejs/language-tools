///<reference types="svelte" />
;function render() { let $$props = __sveltets_2_allPropsType();

    interface $$Props {
        /**
         * comment
         */
         a: boolean;
         b?: string;
    }
     function c() {}
;
async () => {

$$props;};
return { props: { ...__sveltets_2_ensureRightProps<{}>(__sveltets_2_any("") as $$Props)} as {c?: typeof c} & $$Props, exports: {} as any as { c: typeof c }, bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_with_any_event(render()));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;