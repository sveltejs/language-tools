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
return { props: {...__sveltets_2_ensureRightProps<{}>(__sveltets_2_any("") as $$Props), ...{} as unknown as $$Props, ...{c: c} as {c?: typeof c}}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_with_any_event(render())) {
    get c() { return __sveltets_2_nonNullable(this.$$prop_def.c) }
}