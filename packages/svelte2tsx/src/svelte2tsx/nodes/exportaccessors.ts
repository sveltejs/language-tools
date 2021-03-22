import { ExportedNames } from './ExportedNames';

const createClassAccessor = (name: string) =>
    `\n    get ${name}() { return render().props.${name} }` +
    `\n    /**accessor*/\n    set ${name}(_) {}`;

export const createClassAccessors = (getters: Set<string>, exportedNames: ExportedNames) => {
    const accessors: string[] = [];
    for (const [_, value] of exportedNames) {
        if (getters.has(value.identifierText)) {
            continue;
        }

        accessors.push(value.identifierText);
    }

    return accessors.map(createClassAccessor).join('');
};
