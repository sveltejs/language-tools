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

 { const $$_tnenopmoC0C = __sveltets_2_ensureComponent(Component); const $$_tnenopmoC0 = new $$_tnenopmoC0C({ target: __sveltets_2_any(), props: {children:() => { return __sveltets_2_any(0); },box,}});
	 {const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,box,} = $$_tnenopmoC0.$$slot_def["box1"];$$_$$;{ svelteHTML.createElement("svelte:fragment", {  });
		const {area, volume} = calculate(box.width, box.height, constant);
		const perimeter = (box.width + box.height) * constant;
		const [width, height, sum] = [box.width * constant, box.height, box.width * constant + box.height];	
		 { svelteHTML.createElement("div", {});area; volume; perimeter; width; height; sum; }
	 }}

	 {const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,width,height,} = $$_tnenopmoC0.$$slot_def["box2"];$$_$$;{ svelteHTML.createElement("svelte:fragment", {   });
		const {area, volume} = calculate(width, height, constant);
		const perimeter = (width + height) * constant;
		const [_width, _height, sum] = [width * constant, height, width * constant + height];	
		 { svelteHTML.createElement("div", {});area; volume; perimeter; _width; _height; sum; }
	 }}

	 {const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,box:{width, height},} = $$_tnenopmoC0.$$slot_def.default;$$_$$;{ svelteHTML.createElement("svelte:fragment", {  });
		const {area, volume} = calculate(width, height, constant);
		const perimeter = (width + height) * constant;
		const [_width, _height, sum] = [width * constant, height, width * constant + height];	
		 { svelteHTML.createElement("div", {});area; volume; perimeter; _width; _height; sum; }
	 }}
 Component}

 { const $$_tnenopmoC0C = __sveltets_2_ensureComponent(Component); const $$_tnenopmoC0 = new $$_tnenopmoC0C({ target: __sveltets_2_any(), props: { children:() => { return __sveltets_2_any(0); },box,}});{const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,box,} = $$_tnenopmoC0.$$slot_def.default;$$_$$;
	 {const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,box,} = $$_tnenopmoC0.$$slot_def["box1"];$$_$$;{ svelteHTML.createElement("div", {  });
		const {area, volume} = calculate(box.width, box.height, constant);
		const perimeter = (box.width + box.height) * constant;
		const [width, height, sum] = [box.width * constant, box.height, box.width * constant + box.height];	
		 { svelteHTML.createElement("div", {});area; volume; perimeter; width; height; sum; }
	 }}

	 {const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,width,height,} = $$_tnenopmoC0.$$slot_def["box2"];$$_$$;{ svelteHTML.createElement("div", {   });
		const {area, volume} = calculate(width, height, constant);
		const perimeter = (width + height) * constant;
		const [_width, _height, sum] = [width * constant, height, width * constant + height];	
		 { svelteHTML.createElement("div", {});area; volume; perimeter; _width; _height; sum; }
	 }}

	const {area, volume} = calculate(box.width, box.height, constant);
	const perimeter = (box.width + box.height) * constant;
	const [width, height, sum] = [box.width * constant, box.height, box.width * constant + box.height];	
	 { svelteHTML.createElement("div", {});area; volume; perimeter; width; height; sum; }
 }Component}

 { const $$_tnenopmoC0C = __sveltets_2_ensureComponent(Component); const $$_tnenopmoC0 = new $$_tnenopmoC0C({ target: __sveltets_2_any(), props: {  children:() => { return __sveltets_2_any(0); },box,}});{const {/*Ωignore_startΩ*/$$_$$/*Ωignore_endΩ*/,box:{width, height},} = $$_tnenopmoC0.$$slot_def.default;$$_$$;
	const {area, volume} = calculate(width, height, constant);
	const perimeter = (width + height) * constant;
	const [_width, _height, sum] = [width * constant, height, width * constant + height];	
	 { svelteHTML.createElement("div", {});area; volume; perimeter; _width; _height; sum; }
 }Component}};
return { props: {box: box , constant: constant}, exports: {}, bindings: "", slots: {}, events: {} }}
const Input__SvelteComponent_ = __sveltets_2_isomorphic_component(__sveltets_2_partial(['box','constant'], __sveltets_2_with_any_event(render())));
/*Ωignore_startΩ*/type Input__SvelteComponent_ = InstanceType<typeof Input__SvelteComponent_>;
/*Ωignore_endΩ*/export default Input__SvelteComponent_;