import { FileType, Resource, ResourceType } from './types';

import page from './templates/page';
import pageLoad from './templates/page-load';
import pageServer from './templates/page-server';
import layout from './templates/layout';
import layoutLoad from './templates/layout-load';
import layoutServer from './templates/layout-server';
import error from './templates/error';
import server from './templates/server';

export const resourcesMap = new Map<ResourceType, Resource>([
    [ResourceType.PAGE, { type: FileType.PAGE, filename: '+page', generate: page }],
    [ResourceType.PAGE_LOAD, { type: FileType.SCRIPT, filename: '+page', generate: pageLoad }],
    [
        ResourceType.PAGE_SERVER,
        {
            type: FileType.SCRIPT,
            filename: '+page.server',
            generate: pageServer
        }
    ],
    [ResourceType.LAYOUT, { type: FileType.PAGE, filename: '+layout', generate: layout }],
    [
        ResourceType.LAYOUT_LOAD,
        { type: FileType.SCRIPT, filename: '+layout', generate: layoutLoad }
    ],
    [
        ResourceType.LAYOUT_SERVER,
        {
            type: FileType.SCRIPT,
            filename: '+layout.server',
            generate: layoutServer
        }
    ],
    [ResourceType.SERVER, { type: FileType.SCRIPT, filename: '+server', generate: server }],
    [ResourceType.ERROR, { type: FileType.PAGE, filename: '+error', generate: error }]
]);
