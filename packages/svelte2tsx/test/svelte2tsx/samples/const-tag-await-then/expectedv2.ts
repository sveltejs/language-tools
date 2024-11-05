///<reference types="svelte" />
;function render() {

	 let promise1 = {width: 3, height: 4};
	 let promise2 = {width: 5, height: 7};
	 let constant = 10;

	function calculate(width, height, constant) {
		return { area: width * height, volume: width * height * constant };
	}
;
async () => {

   { const $$_value = await (promise1);{ const box = $$_value; 
	const {area, volume} = calculate(box.width, box.height, constant);
	const perimeter = (box.width + box.height) * constant;
	const [width, height, sum] = [box.width * constant, box.height, box.width * constant + box.height];
	 { svelteHTML.createElement("div", {});area; volume; perimeter; width; height; sum; }
}}

   { try { await (promise2);} catch($$_e) { const box = __sveltets_2_any();
	const {area, volume} = calculate(box.width, box.height, constant);
	const perimeter = (box.width + box.height) * constant;
	const [width, height, sum] = [box.width * constant, box.height, box.width * constant + box.height];
	 { svelteHTML.createElement("div", {});area; volume; perimeter; width; height; sum; }
}}};
return { props: {promise1: promise1 , promise2: promise2 , constant: constant}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['promise1','promise2','constant'], __sveltets_2_with_any_event(render()))) {
}