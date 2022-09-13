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
    [ResourceType.PAGE, { type: FileType.PAGE, filename: '+page', title: 'Page', generate: page }],
    [
        ResourceType.PAGE_LOAD,
        { type: FileType.SCRIPT, filename: '+page', title: 'Page load', generate: pageLoad }
    ],
    [
        ResourceType.PAGE_SERVER,
        {
            type: FileType.SCRIPT,
            filename: '+page.server',
            title: 'Page server load',
            generate: pageServer
        }
    ],
    [
        ResourceType.LAYOUT,
        { type: FileType.PAGE, filename: '+layout', title: 'Layout', generate: layout }
    ],
    [
        ResourceType.LAYOUT_LOAD,
        { type: FileType.SCRIPT, filename: '+layout', title: 'Layout load', generate: layoutLoad }
    ],
    [
        ResourceType.LAYOUT_SERVER,
        {
            type: FileType.SCRIPT,
            filename: '+layout.server',
            title: 'Layout server load',
            generate: layoutServer
        }
    ],
    [
        ResourceType.SERVER,
        { type: FileType.SCRIPT, filename: '+server', title: 'Server', generate: server }
    ],
    [
        ResourceType.ERROR,
        { type: FileType.PAGE, filename: '+error', title: 'Error', generate: error }
    ]
]);
