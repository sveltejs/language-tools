export const IGNORE_START_COMMENT = '/*Ωignore_startΩ*/';
export const IGNORE_END_COMMENT = '/*Ωignore_endΩ*/';

/**
 * Surrounds given string with a start/end comment which marks it
 * to be ignored by tooling.
 */
export function surroundWithIgnoreComments(str: string): string {
    return IGNORE_START_COMMENT + str + IGNORE_END_COMMENT;
}
