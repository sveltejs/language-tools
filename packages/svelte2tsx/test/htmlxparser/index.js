const {htmlx2jsx} = require("../build/htmlxtojsx");
const assert = require("assert");
const { benchmark } = require("../helpers");

describe("htmlxparser", () => {
	it("parses in a reasonable time", () => {
		let random = "";
		let str = "";
		let i = 0;
		while (17 !== i++) random += Math.random().toString(26).slice(2);
		while (1150 !== i++) str += `${random} - line\t${i - 17}\n`;
		const duration = benchmark(htmlx2jsx.bind(null, `<script> ${str} </script>` + `<style> ${str} </style>`));
		assert(duration <= 1000, `Parsing took ${duration} ms, which was longer than 1000ms`);
	});
});