export enum CommandType {
    PAGE = 'svelte.kit.generatePage',
    PAGE_LOAD = 'svelte.kit.generatePageLoad',
    PAGE_SERVER = 'svelte.kit.generatePageServerLoad',
    LAYOUT = 'svelte.kit.generateLayout',
    LAYOUT_LOAD = 'svelte.kit.generateLayoutLoad',
    LAYOUT_SERVER = 'svelte.kit.generateLayoutServerLoad',
    SERVER = 'svelte.kit.generateServer',
    ERROR = 'svelte.kit.generateError',
    MULTIPLE = 'svelte.kit.generateMultipleFiles',
}

export enum FileType {
    SCRIPT,
    PAGE,
}

export enum ResourceType {
    PAGE,
    PAGE_LOAD,
    PAGE_SERVER,
    LAYOUT,
    LAYOUT_LOAD,
    LAYOUT_SERVER,
    SERVER,
    ERROR,
}

export type Resource = {
    type: FileType,
    filename: string,
    title: string,
    generate: (config: TemplateConfig) => Promise<string>
}

export interface ICommand {
    resources: ResourceType[];
}

export interface TemplateConfig {
    path: string;
    typescript: boolean;
    resources: Resource[];
    pageExtension: string;
    scriptExtension: string;
}

