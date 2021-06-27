///<reference types="svelte" />
<></>;function render() {

	 let promise1 = {width: 3, height: 4};
	 let promise2 = {width: 5, height: 7};
	 let constant = 10;

	function calculate(width, height, constant) {
		return { area: width * height, volume: width * height * constant };
	}
;
() => (<>

{() => {let _$$p = (promise1); __sveltets_1_awaitThen(_$$p, ({ width, height }) => {const {area, volume} = calculate(width, height, constant);const perimeter = (width + height) * constant;const [_width, _height, sum] = [width * constant, height, width * constant + height];<>
	{ }
	{ }
	{ }
	<div>{area} {volume} {perimeter}, {_width}+{_height}={sum}</div>
</>})}}

{() => {let _$$p = (promise2 ); __sveltets_awaitThen(_$$p, () => {}, ({ width, height }) => {const {area, volume} = calculate(width, height, constant);const perimeter = (width + height) * constant;const [_width, _height, sum] = [width * constant, height, width * constant + height];<>
	{ }
	{ }
	{ }
	<div>{area} {volume} {perimeter}, {_width}+{_height}={sum}</div>
</>})}}</>);
return { props: {promise1: promise1 , promise2: promise2 , constant: constant}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(['promise1','promise2','constant'], __sveltets_1_with_any_event(render()))) {
}