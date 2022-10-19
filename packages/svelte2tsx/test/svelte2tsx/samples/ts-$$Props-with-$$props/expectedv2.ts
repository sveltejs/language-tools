///<reference types="svelte" />
;function render() { let $$props = __sveltets_1_allPropsType();

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
return { props: {...__sveltets_1_ensureRightProps<{}>(__sveltets_1_any("") as $$Props), ...__sveltets_1_ensureRightProps<Partial<$$Props>>({}), ...{} as unknown as $$Props, ...{c: c} as {c?: typeof c}}, slots: {}, getters: {c: c}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_with_any_event(render())) {
    get c() { return this.$$prop_def.c }
}