import { ICommand, CommandType, ResourceType } from './types';

export const commandsMap = new Map<CommandType, ICommand>([
    [CommandType.PAGE, { resources: [ResourceType.PAGE] }],
    [CommandType.PAGE_LOAD, { resources: [ResourceType.PAGE_LOAD] }],
    [CommandType.PAGE_SERVER, { resources: [ResourceType.PAGE_SERVER] }],
    [CommandType.LAYOUT, { resources: [ResourceType.LAYOUT] }],
    [CommandType.LAYOUT_LOAD, { resources: [ResourceType.LAYOUT_LOAD] }],
    [CommandType.LAYOUT_SERVER, { resources: [ResourceType.LAYOUT_SERVER] }],
    [CommandType.SERVER, { resources: [ResourceType.SERVER] }],
    [CommandType.ERROR, { resources: [ResourceType.ERROR] }],
    [CommandType.MULTIPLE, { resources: [] }]
]);
