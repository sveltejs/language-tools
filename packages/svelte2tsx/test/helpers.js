const fs = require("fs");
const assert = require("assert");
function benchmark(fn) {
	return -Date.now() + (fn(), Date.now());
}
function readFileSync(path) {
	return fs.existsSync(path) ? fs.readFileSync(path, "utf-8").replace(/\r\n/g, "\n").replace(/\s+$/, "") : null;
}
function check_dir(path, { allow, require = allow }) {
	if (allow !== require) allow = [...require, ...allow];
	const unchecked = new Set(require);
	const unknown = new Set();
	a: for (const fileName of fs.readdirSync(path)) {
		for (const name of unchecked)
			if (name === fileName || (name.startsWith("*") && fileName.endsWith(name.slice(1)))) {
				unchecked.delete(name);
				continue a;
			}
		if (!allow.includes(fileName)) unknown.add(fileName);
	}

	if (unknown.size) {
		after(() => {
			for (const f of unknown) {
				const file = `${path.split("/").slice(-1)}/${f}`
				if (process.env.CI) throw new Error(`Unexpected file ${file}`);
				console.info(`Ignored file ${file}`);
			}
		});
	}
	if (unchecked.size) {
		throw new Error(`Expected file(s) ${[...unchecked].map((str) => `"${str}"`).join(", ")} in ${path}`);
	}
}

function test_samples(dir, transform, tsx) {
	for (const testName of fs.readdirSync(`${dir}/samples`)) {
		const path = `${dir}/samples/${testName}`;
		const expected_path = `${path}/expected.${tsx}`
		const has_expected = fs.existsSync(expected_path);
		const solo = testName.endsWith(".solo");
		const skip = testName.startsWith(".");

		check_dir(path, {
			require: ["*.svelte"],
			allow: ["expected.js", `expected.${tsx}`],
		});
		(skip ? it.skip : solo ? it.only : it)(testName, function () {
			const fileName = fs.readdirSync(path).find((f) => f.endsWith(".svelte"));
			const output = transform(
				readFileSync(`${path}/${fileName}`),
				testName,
				fileName
			);
			if (!has_expected) {
				after(() => {
					fs.writeFileSync(expected_path, output.code);
					console.info(`Generated ${testName}/expected.${tsx}`);
				});
				this.skip();
			} else {
				assert.strictEqual(output.code, readFileSync(expected_path));
			}
			if (fs.existsSync(`${path}/expected.js`)) {
				const run = require(`${path}/expected.js`);
				run(output);
			}
		});
	}
}
module.exports = { benchmark, test_samples };
