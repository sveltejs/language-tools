///<reference types="svelte" />
<></>;
import Component from './Component.svelte';
function render() {

	
	 let box = {width: 3, height: 4};
	 let constant = 10;

	function calculate(width, height, constant) {
		return { area: width * height, volume: width * height * constant };
	}
;
() => (<>

<Component box={box}>
	{() => { let {box} = /*Ωignore_startΩ*/new Component({target: __sveltets_1_any(''), props: {'box':box}})/*Ωignore_endΩ*/.$$slot_def['box1'];/*<*/const {area, volume} = __sveltets_1_const(() => (calculate(box.width, box.height, constant)));const perimeter = __sveltets_1_const(() => ((box.width + box.height) * constant));const [width, height, sum] = __sveltets_1_const(() => ([box.width * constant, box.height, box.width * constant + box.height]));<><sveltefragment  >
		{ }
		{ }
		{ }	
		<div>{area} {volume} {perimeter}, {width}+{height}={sum}</div>
	</sveltefragment></>}}

	{() => { let {width, height} = /*Ωignore_startΩ*/new Component({target: __sveltets_1_any(''), props: {'box':box}})/*Ωignore_endΩ*/.$$slot_def['box2'];/*<*/const {area, volume} = __sveltets_1_const(() => (calculate(width, height, constant)));const perimeter = __sveltets_1_const(() => ((width + height) * constant));const [_width, _height, sum] = __sveltets_1_const(() => ([width * constant, height, width * constant + height]));<><sveltefragment   >
		{ }
		{ }
		{ }	
		<div>{area} {volume} {perimeter}, {_width}+{_height}={sum}</div>
	</sveltefragment></>}}

	{() => { let {box:{width, height}} = /*Ωignore_startΩ*/new Component({target: __sveltets_1_any(''), props: {'box':box}})/*Ωignore_endΩ*/.$$slot_def['default'];/*<*/const {area, volume} = __sveltets_1_const(() => (calculate(width, height, constant)));const perimeter = __sveltets_1_const(() => ((width + height) * constant));const [_width, _height, sum] = __sveltets_1_const(() => ([width * constant, height, width * constant + height]));<><sveltefragment >
		{ }
		{ }
		{ }	
		<div>{area} {volume} {perimeter}, {_width}+{_height}={sum}</div>
	</sveltefragment></>}}
</Component>

<Component box={box} >{() => {/*Ωignore_startΩ*/const Ψbox=box;/*Ωignore_endΩ*/() => { let {box} = /*Ωignore_startΩ*/new Component({target: __sveltets_1_any(''), props: {'box':Ψbox}})/*Ωignore_endΩ*/.$$slot_def['default'];/*
*/const {area, volume} = __sveltets_1_const(() => (calculate(box.width, box.height, constant)));const perimeter = __sveltets_1_const(() => ((box.width + box.height) * constant));const [width, height, sum] = __sveltets_1_const(() => ([box.width * constant, box.height, box.width * constant + box.height]));<>
	{() => { let {box} = /*Ωignore_startΩ*/new Component({target: __sveltets_1_any(''), props: {'box':Ψbox}})/*Ωignore_endΩ*/.$$slot_def['box1'];/*<*/const {area, volume} = __sveltets_1_const(() => (calculate(box.width, box.height, constant)));const perimeter = __sveltets_1_const(() => ((box.width + box.height) * constant));const [width, height, sum] = __sveltets_1_const(() => ([box.width * constant, box.height, box.width * constant + box.height]));<><div  >
		{ }
		{ }
		{ }	
		<div>{area} {volume} {perimeter}, {width}+{height}={sum}</div>
	</div></>}}

	{() => { let {width, height} = /*Ωignore_startΩ*/new Component({target: __sveltets_1_any(''), props: {'box':Ψbox}})/*Ωignore_endΩ*/.$$slot_def['box2'];/*<*/const {area, volume} = __sveltets_1_const(() => (calculate(width, height, constant)));const perimeter = __sveltets_1_const(() => ((width + height) * constant));const [_width, _height, sum] = __sveltets_1_const(() => ([width * constant, height, width * constant + height]));<><div   >
		{ }
		{ }
		{ }	
		<div>{area} {volume} {perimeter}, {_width}+{_height}={sum}</div>
	</div></>}}

	{ }
	{ }
	{ }	
	<div>{area} {volume} {perimeter}, {width}+{height}={sum}</div>
</>}}}</Component>

<Component box={box} >{() => {/*Ωignore_startΩ*/const Ψbox=box;/*Ωignore_endΩ*/() => { let {box:{width, height}} = /*Ωignore_startΩ*/new Component({target: __sveltets_1_any(''), props: {'box':Ψbox}})/*Ωignore_endΩ*/.$$slot_def['default'];/*
*/const {area, volume} = __sveltets_1_const(() => (calculate(width, height, constant)));const perimeter = __sveltets_1_const(() => ((width + height) * constant));const [_width, _height, sum] = __sveltets_1_const(() => ([width * constant, height, width * constant + height]));<>
	{ }
	{ }
	{ }	
	<div>{area} {volume} {perimeter}, {_width}+{_height}={sum}</div>
</>}}}</Component></>);
return { props: {box: box , constant: constant}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(['box','constant'], __sveltets_1_with_any_event(render()))) {
}