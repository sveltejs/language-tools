///<reference types="svelte" />
;
import Component from './Component.svelte';
function render() {

	
	 let box = {width: 3, height: 4};
	 let constant = 10;

	function calculate(width, height, constant) {
		return { area: width * height, volume: width * height * constant };
	}
;
async () => {

  { const $$_Component0 = new Component({ target: __sveltets_2_any(), props: {box,}});
	  {const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,box,} = $$_Component0.$$slot_def["box1"];$$_$$;{ __sveltets_2_createElement("sveltefragment", {});
		 const {area, volume} = calculate(box.width, box.height, constant);
		 const perimeter = (box.width + box.height) * constant;
		 const [width, height, sum] = [box.width * constant, box.height, box.width * constant + box.height];	
		 { __sveltets_2_createElement("div", {});area; volume; perimeter; width; height; sum; }
	 }}

	   {const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,width,height,} = $$_Component0.$$slot_def["box2"];$$_$$;{ __sveltets_2_createElement("sveltefragment", {});
		 const {area, volume} = calculate(width, height, constant);
		 const perimeter = (width + height) * constant;
		 const [_width, _height, sum] = [width * constant, height, width * constant + height];	
		 { __sveltets_2_createElement("div", {});area; volume; perimeter; _width; _height; sum; }
	 }}

	  {const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,box:{width, height},} = $$_Component0.$$slot_def.default;$$_$$;{ __sveltets_2_createElement("sveltefragment", {});
		 const {area, volume} = calculate(width, height, constant);
		 const perimeter = (width + height) * constant;
		 const [_width, _height, sum] = [width * constant, height, width * constant + height];	
		 { __sveltets_2_createElement("div", {});area; volume; perimeter; _width; _height; sum; }
	 }}
 Component}

   { const $$_Component0 = new Component({ target: __sveltets_2_any(), props: {box,}});{const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,box,} = $$_Component0.$$slot_def.default;$$_$$;
	   {const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,box,} = $$_Component0.$$slot_def["box1"];$$_$$;{ __sveltets_2_createElement("div", {});
		 const {area, volume} = calculate(box.width, box.height, constant);
		 const perimeter = (box.width + box.height) * constant;
		 const [width, height, sum] = [box.width * constant, box.height, box.width * constant + box.height];	
		 { __sveltets_2_createElement("div", {});area; volume; perimeter; width; height; sum; }
	 }}

	    {const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,width,height,} = $$_Component0.$$slot_def["box2"];$$_$$;{ __sveltets_2_createElement("div", {});
		 const {area, volume} = calculate(width, height, constant);
		 const perimeter = (width + height) * constant;
		 const [_width, _height, sum] = [width * constant, height, width * constant + height];	
		 { __sveltets_2_createElement("div", {});area; volume; perimeter; _width; _height; sum; }
	 }}

	 const {area, volume} = calculate(box.width, box.height, constant);
	 const perimeter = (box.width + box.height) * constant;
	 const [width, height, sum] = [box.width * constant, box.height, box.width * constant + box.height];	
	 { __sveltets_2_createElement("div", {});area; volume; perimeter; width; height; sum; }
 }Component}

    { const $$_Component0 = new Component({ target: __sveltets_2_any(), props: {box,}});{const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,box:{width, height},} = $$_Component0.$$slot_def.default;$$_$$;
	 const {area, volume} = calculate(width, height, constant);
	 const perimeter = (width + height) * constant;
	 const [_width, _height, sum] = [width * constant, height, width * constant + height];	
	 { __sveltets_2_createElement("div", {});area; volume; perimeter; _width; _height; sum; }
 }Component}};
return { props: {box: box , constant: constant}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(['box','constant'], __sveltets_1_with_any_event(render()))) {
}