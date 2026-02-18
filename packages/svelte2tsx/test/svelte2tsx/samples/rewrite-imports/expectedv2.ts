///<reference types="svelte" />
;
    import foo1 from '../../../foo';
    import('../../../bar');
    export { x } from '../..';

    /** @param {import('../../../mhm'.mhm)} mhm */
    function f(mhm) {}
;;

import foo2 from '../../../foo';
function $$render() {

    
    import('../../../bar');

    /** @type {import('../../../mhm').mhm} */
    let mhm = true;

    /** @param {import('../../../mhm'.mhm)} mhm */
    function f(mhm) {}
;
async () => {



  { svelteHTML.createElement("button", {  "onclick":() => {
        import('../../../bar');
        /** @type {import('../../../mhm').mhm} */
        let mhm = true;
        /** @param {import('../../../mhm').mhm} mhm */
        function f(mhm) {}
    },});  }};
return { props: /** @type {Record<string, never>} */ ({}), slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event($$render()))) {
}