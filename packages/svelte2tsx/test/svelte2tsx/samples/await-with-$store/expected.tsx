<></>;
import { readable } from 'svelte/store';
function render() {

	
	const store = readable(Promise.resolve('test'), () => {});
;
() => (<>

{() => {let _$$p = (__sveltets_store_get(store)); <>
	<p>loading</p>
</>; __sveltets_awaitThen(_$$p, (data) => {<>
	{data}
</>})}}</>);
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends createSvelte2TsxComponent(__sveltets_partial(render)) {
}
