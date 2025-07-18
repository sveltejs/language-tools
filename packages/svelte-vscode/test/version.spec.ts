import { expect, describe, it } from 'vitest';
import { versionSplit, minimumRequirement } from '../src/version';

describe('versionSplit', () => {
    const combinationsVersionSplit: {
        version: string;
        focus?: keyof ReturnType<typeof versionSplit>;
        expected: ReturnType<typeof versionSplit>;
    }[] = [
        {
            version: '18.13.0',
            expected: {
                major: 18,
                minor: 13,
                patch: 0,
                info: 'equal',
                specifier: 'patch',
                isValid: true
            }
        },
        {
            version: 'x.13.0',
            focus: 'isValid',
            expected: { isValid: false }
        },
        {
            version: '18.y.0',
            focus: 'isValid',
            expected: { isValid: false }
        },
        {
            version: '18.13.z',
            expected: {
                major: 18,
                minor: 13,
                info: 'equal',
                specifier: 'minor',
                isValid: true
            }
        },
        {
            version: '18',
            expected: {
                major: 18,
                info: 'equal',
                specifier: 'major',
                isValid: true
            }
        },
        {
            version: '18.13',
            expected: {
                major: 18,
                minor: 13,
                info: 'equal',
                specifier: 'minor',
                isValid: true
            }
        },
        {
            version: 'invalid',
            focus: 'isValid',
            expected: { isValid: false }
        },
        {
            version: '>=18',
            expected: {
                major: 18,
                info: 'gte',
                specifier: 'major',
                isValid: true
            }
        },
        {
            version: '>=18.7',
            expected: {
                major: 18,
                minor: 7,
                info: 'gte',
                specifier: 'minor',
                isValid: true
            }
        },
        {
            version: '>18',
            expected: {
                major: 18,
                info: 'gt',
                specifier: 'major',
                isValid: true
            }
        },
        {
            version: '>18.7',
            expected: {
                major: 18,
                minor: 7,
                info: 'gt',
                specifier: 'minor',
                isValid: true
            }
        },
        {
            version: '1.1.1-beta.1',
            expected: {
                major: 1,
                minor: 1,
                patch: 1,
                beta: 'beta.1',
                info: 'is-patch-beta',
                specifier: 'patch',
                isValid: true
            }
        }
    ];
    it.each(combinationsVersionSplit)('should handle $version', ({ version, expected, focus }) => {
        const res = versionSplit(version);
        if (focus) {
            expect(res[focus]).toEqual(expected[focus]);
        } else {
            expect(res).toEqual(expected);
        }
    });
});

describe('minimumRequirement', () => {
    const combinationsMinimumRequirement = [
        { version: '17', below: '18.3.0', expected: true },
        { version: '18.2', below: '18.3.0', expected: true },
        { version: '18.3.0', below: '18.3.1', expected: true },
        { version: '18.3.1', below: '18.3.0', expected: false },
        { version: '18.3.0', below: '18.3.0', expected: false },
        { version: '18.3.0', below: '18.3', expected: false },
        { version: '18.3.1', below: '18.3', expected: false },
        { version: '18.3.1', below: '18', expected: false },
        { version: '18', below: '18', expected: false },
        { version: 'a', below: 'b', expected: undefined },
        { version: '18.3', below: '18.3', expected: false },
        { version: '18.4', below: '18.3', expected: false },
        { version: '18.2', below: '18.3', expected: true },

        // if it's undefined, we can't say anything...
        { version: undefined!, below: '18.3', expected: undefined },
        { version: '', below: '18.3', expected: undefined }
    ] as const;
    it.each(combinationsMinimumRequirement)(
        '($version below $below) should be $expected',
        ({ version, below, expected }) => {
            expect(minimumRequirement(below).for(version)).toEqual(expected);
        }
    );
});
