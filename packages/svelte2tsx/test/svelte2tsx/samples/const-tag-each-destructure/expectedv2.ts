///<reference types="svelte" />
;function render() {

	 let boxes = [
		{width: 3, height: 4},
		{width: 5, height: 7},
		{width: 6, height: 8},
	];
	 let constant = 10;

	function calculate(width, height, constant) {
		return { area: width * height, volume: width * height * constant };
	}
;
async () => {

  for(let { width, height } of __sveltets_2_ensureArray(boxes)){
	const {area, volume} = calculate(width, height, constant);
	const perimeter = (width + height) * constant;
	const [_width, _height, sum] = [width * constant, height, width * constant + height];
	 { svelteHTML.createElement("div", {});area; volume; perimeter; _width; _height; sum; }
}};
return { props: {boxes: boxes , constant: constant}, slots: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(['boxes','constant'], __sveltets_2_with_any_event(render()))) {
}