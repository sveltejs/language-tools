import ts from 'typescript';
import type { TsFacade } from './facade';

/**
 * The TypeScript 6 (and 5, 4.9) implementation of the facade.
 * The facade has the signatures of TypeScript 6, so this is simply the `ts` namespace.
 */
export const tsFacade: TsFacade = ts;
