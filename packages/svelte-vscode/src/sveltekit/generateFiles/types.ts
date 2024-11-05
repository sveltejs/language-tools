export enum CommandType {
    PAGE = 'svelte.kit.generatePage',
    PAGE_LOAD = 'svelte.kit.generatePageLoad',
    PAGE_SERVER = 'svelte.kit.generatePageServerLoad',
    LAYOUT = 'svelte.kit.generateLayout',
    LAYOUT_LOAD = 'svelte.kit.generateLayoutLoad',
    LAYOUT_SERVER = 'svelte.kit.generateLayoutServerLoad',
    SERVER = 'svelte.kit.generateServer',
    ERROR = 'svelte.kit.generateError',
    MULTIPLE = 'svelte.kit.generateMultipleFiles'
}

export enum FileType {
    SCRIPT,
    PAGE
}

export enum ResourceType {
    PAGE,
    PAGE_LOAD,
    PAGE_SERVER,
    LAYOUT,
    LAYOUT_LOAD,
    LAYOUT_SERVER,
    SERVER,
    ERROR
}

export type Resource = {
    type: FileType;
    filename: string;
    generate: (config: GenerateConfig) => Promise<string>;
};

export enum ProjectType {
    TS_SV5 = 'ts-sv5',
    JS_SV5 = 'js-sv5',
    TS_SATISFIES_SV5 = 'ts-satisfies-sv5',
    TS = 'ts',
    JS = 'js',
    TS_SATISFIES = 'ts-satisfies'
}

export type IsSvelte5Plus = boolean;

export const IsSvelte5Plus: Record<string, IsSvelte5Plus> = {
    yes: true,
    no: false
};

export interface GenerateConfig {
    path: string;
    type: ProjectType;
    pageExtension: string;
    scriptExtension: string;
    resources: Resource[];
}
