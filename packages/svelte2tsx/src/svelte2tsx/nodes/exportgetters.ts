const createClassGetter = (name: string) =>
	`\n    get ${name}() { return render().getters.${name} }`;

export const createClassGetters = (names: Set<string>) => {
	return Array.from(names).map(createClassGetter).join('');
};

export function createRenderFunctionGetterStr(getters: Set<string>) {
	const properties = Array.from(getters).map((name) => `${name}: ${name}`);
	return `{${properties.join(', ')}}`;
}
