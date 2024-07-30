export const IGNORE_START_COMMENT = '/*Ωignore_startΩ*/';
export const IGNORE_END_COMMENT = '/*Ωignore_endΩ*/';
/** to tell tooling to ignore the character at this position; can for example be used to ignore everything starting at this position */
export const IGNORE_POSITION_COMMENT = '/*Ωignore_positionΩ*/';

/**
 * Surrounds given string with a start/end comment which marks it
 * to be ignored by tooling.
 */
export function surroundWithIgnoreComments(str: string): string {
    return IGNORE_START_COMMENT + str + IGNORE_END_COMMENT;
}
