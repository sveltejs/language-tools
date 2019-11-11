"use strict";
exports.__esModule = true;
<></>;
function render() {
    var i = 0;
    var undoStack = [[]];
    var circles = [];
    var selected;
    var adjusting = false;
    var adjusted = false;
    function handleClick(event) {
        if (adjusting) {
            adjusting = false;
            // if circle was adjusted,
            // push to the stack
            if (adjusted)
                push();
            return;
        }
        var circle = {
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
        var newUndoStack = undoStack.slice(0, ++i);
        newUndoStack.push(clone(circles));
        undoStack = newUndoStack;
    }
    function travel(d) {
        circles = clone(undoStack[i += d]);
        adjusting = false;
    }
    function clone(circles) {
        return circles.map(function (_a) {
            var cx = _a.cx, cy = _a.cy, r = _a.r;
            return ({ cx: cx, cy: cy, r: r });
        });
    }
    ;
    <>





    <div class="controls">
	<button onClick="{() => travel(-1)}" disabled={i === 0}>undo</button>
	<button onClick="{() => travel(+1)}" disabled={i === undoStack.length - 1}>redo</button>
    </div>

    <svg onClick={handleClick}>
	{(circles).map(function (circle) { return <>
		<circle cx={circle.cx} cy={circle.cy} r={circle.r} onClick="{event => select(circle, event)}" onContextmenu="{() => {
				adjusting = !adjusting;
				if (adjusting) selected = circle;
			}}" fill={circle === selected ? '#ccc' : 'white'}/>
	</>; })}
    </svg>

    {function () {
        if (adjusting) {
            <>
	<div class="adjuster">
		<p>adjust diameter of circle at {selected.cx}, {selected.cy}</p>
		<input type="range" value={selected.r} onInput={adjust}/>
	</div>
            </>;
        }
    }}</>;
    return { props: {}, slots: {} };
}
var default_1 = /** @class */ (function () {
    function default_1() {
        this.$$prop_def = render().props;
        this.$$slot_def = render().slots;
    }
    return default_1;
}());
exports["default"] = default_1;
