import { CommandType, ResourceType } from './types';

export const addResourceCommandMap = new Map<CommandType, ResourceType>([
    [CommandType.PAGE, ResourceType.PAGE],
    [CommandType.PAGE_LOAD, ResourceType.PAGE_LOAD],
    [CommandType.PAGE_SERVER, ResourceType.PAGE_SERVER],
    [CommandType.LAYOUT, ResourceType.LAYOUT],
    [CommandType.LAYOUT_LOAD, ResourceType.LAYOUT_LOAD],
    [CommandType.LAYOUT_SERVER, ResourceType.LAYOUT_SERVER],
    [CommandType.SERVER, ResourceType.SERVER],
    [CommandType.ERROR, ResourceType.ERROR]
]);
