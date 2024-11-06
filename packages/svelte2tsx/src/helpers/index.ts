import { get_global_types } from './files';
import {
    isHooksFile,
    isKitFile,
    isKitRouteFile,
    isParamsFile,
    toOriginalPos,
    toVirtualPos,
    upsertKitFile
} from './sveltekit';
import { findExports } from './typescript';

/**
 * ## Internal, do not use! This is subject to change at any time.
 *
 * Implementation notice: If one of the methods use a TypeScript function which is not from the
 * static top level `ts` namespace, it must be passed as a parameter.
 */
export const internalHelpers = {
    isKitFile,
    isKitRouteFile,
    isHooksFile,
    isParamsFile,
    upsertKitFile,
    toVirtualPos,
    toOriginalPos,
    findExports,
    get_global_types
};
