import {
    isClientHooksFile,
    isKitFile,
    isKitRouteFile,
    isParamsFile,
    isServerHooksFile,
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
    isClientHooksFile,
    isServerHooksFile,
    isParamsFile,
    upsertKitFile,
    toVirtualPos,
    toOriginalPos,
    findExports
};
