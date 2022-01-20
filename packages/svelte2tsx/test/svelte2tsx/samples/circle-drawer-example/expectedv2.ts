///<reference types="svelte" />
;function render() {

	let i = 0;
	let undoStack = [[]];
	let circles = [];
	let selected;
	let adjusting = false;
	let adjusted = false;

	function handleClick(event) {
		if (adjusting) {
			adjusting = false;

			// if circle was adjusted,
			// push to the stack
			if (adjusted) push();
			return;
		}

		const circle = {
			cx: event.clientX,
			cy: event.clientY,
			r: 50
		};

		circles = circles.concat(circle);
		selected = circle;

		push();
	}

	function adjust(event) {
		selected.r = +event.target.value;
		circles = circles;
		adjusted = true;
	}

	function select(circle, event) {
		if (!adjusting) {
			event.stopPropagation();
			selected = circle;
		}
	}

	function push() {
		const newUndoStack = undoStack.slice(0, ++i);
		newUndoStack.push(clone(circles));
		undoStack = newUndoStack;
	}

	function travel(d) {
		circles = clone(undoStack[i += d]);
		adjusting = false;
	}

	function clone(circles) {
		return circles.map(({ cx, cy, r }) => ({ cx, cy, r }));
	}
;
async () => {





   { svelteHTML.createElement("div", {"class":"controls",});
	      { svelteHTML.createElement("button", {onclick:() => travel(-1),"disabled":i === 0,});  }
	      { svelteHTML.createElement("button", {onclick:() => travel(+1),"disabled":i === undoStack.length -1,});  }
 }

    { svelteHTML.createElement("svg", {onclick:handleClick,});
	  for(const circle of __sveltets_2_ensureArray(circles)){
		              { svelteHTML.createElement("circle", {"cx":circle.cx,"cy":circle.cy,"r":circle.r,onclick:event => select(circle, event),oncontextmenu:() => {
				adjusting = !adjusting;
				if (adjusting) selected = circle;
			},"fill":circle === selected ? '#ccc': 'white',});}
	}
 }

if(adjusting){
	   { svelteHTML.createElement("div", {"class":"adjuster",});
		 { svelteHTML.createElement("p", {});     selected.cx; selected.cy; }
		       { svelteHTML.createElement("input", {"type":"range","value":selected.r,oninput:adjust,});}
	 }
}};
return { props: {}, slots: {}, getters: {}, events: {} }}

export default class Input__SvelteComponent_ extends __sveltets_1_createSvelte2TsxComponent(__sveltets_1_partial(__sveltets_1_with_any_event(render()))) {
}