import MagicString from 'magic-string';
import { DeclarationTag } from '../../interfaces';

/**
 * `{let x = y}` --> `let x = y;`
 */
export function handleDeclarationTag(str: MagicString, declarationTag: DeclarationTag): void {
    str.remove(declarationTag.start, declarationTag.declaration.start);
    str.overwrite(declarationTag.declaration.end, declarationTag.end, ';');
}
