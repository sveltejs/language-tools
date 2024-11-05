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

   { const $$_value = await (promise1);{ const { width, height } = $$_value; 
	const {area, volume} = calculate(width, height, constant);
	const perimeter = (width + height) * constant;
	const [_width, _height, sum] = [width * constant, height, width * constant + height];
	 { svelteHTML.createElement("div", {});area; volume; perimeter; _width; _height; sum; }
}}

   { try { await (promise2);} catch($$_e) { const { width, height } = __sveltets_2_any();
	const {area, volume} = calculate(width, height, constant);
	const perimeter = (width + height) * constant;
	const [_width, _height, sum] = [width * constant, height, width * constant + height];
	 { svelteHTML.createElement("div", {});area; volume; perimeter; _width; _height; sum; }
}}};
return { props: {promise1: promise1 , promise2: promise2 , constant: constant}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['promise1','promise2','constant'], __sveltets_2_with_any_event(render()))) {
}