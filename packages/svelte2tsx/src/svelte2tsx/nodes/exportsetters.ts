export const createClassSetter = (name: string) =>
    `\n
    /**accessor*/\n${' '.repeat(4)}set ${name}(${name}) {}`;

export const createClassSetters = (names: Set<string>) => {
    return Array.from(names).map(createClassSetter).join('');
};

export function createRenderFunctionSetterStr(setters: Set<string>) {
    const properties = Array.from(setters).map((name) => `${name}: ${name}`);
    return `{${properties.join(', ')}}`;
}