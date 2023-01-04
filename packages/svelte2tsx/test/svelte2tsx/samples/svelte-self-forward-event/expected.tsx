///<reference types="svelte" />
<></>;
import { createEventDispatcher } from "svelte";
function render() {

    

    let a = [''];
    const dispatch = createEventDispatcher<{
        foo: string
    }>();
;
() => (<>

{__sveltets_1_each(a, (item) => <>
    <svelteself ></svelteself>
</>)}</>);
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {...__sveltets_2_toEventTypings<{
        foo: string
    }>()} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {
}