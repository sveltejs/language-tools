const svelte2tsx = require("../build/index");
const { test_samples } = require("../helpers");

describe("svelte2tsx", () => {
	test_samples(__dirname, (input, testName, filename) => {
		return svelte2tsx(input, {
			strictMode: testName.includes("strictMode"),
			isTsFile: testName.startsWith("ts-"),
			filename,
		})
	}, "tsx")
});
