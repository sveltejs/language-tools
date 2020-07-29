// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface IExportedNames {
    has(name: string): boolean;
}

export class ExportedNames
    extends Map<
        string,
        {
            type?: string;
            identifierText?: string;
            required?: boolean;
        }
    >
    implements IExportedNames {
    /**
     * Creates a string from the collected props
     *
     * @param isTsFile Whether this is a TypeScript file or not.
     */
    createPropsStr(isTsFile: boolean) {
        const names = Array.from(this.entries());

        const returnElements = names.map(([key, value]) => {
            // Important to not use shorthand props for rename functionality
            return `${value.identifierText || key}: ${key}`;
        });

        if (
            !isTsFile ||
            names.length === 0 ||
            names.every(([_, value]) => !value.type && value.required)
        ) {
            // No exports or only `typeof` exports -> omit the `as {...}` completely.
            // If not TS, omit the types to not have a "cannot use types in jsx" error.
            return `{${returnElements.join(' , ')}}`;
        }

        const returnElementsType = names.map(([key, value]) => {
            const identifier = `${value.identifierText || key}${value.required ? '' : '?'}`;
            if (!value.type) {
                return `${identifier}: typeof ${key}`;
            }

            return `${identifier}: ${value.type}`;
        });

        return `{${returnElements.join(' , ')}} as {${returnElementsType.join(', ')}}`;
    }
}
