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

describe.only('minimumRequirement', () => {
    const combinationsMinimumRequirement = [
        // strict
        { min: '18.3.0', version: '17', unsupported: true },
        { min: '18.3.0', version: '18.2', unsupported: true },
        { min: '18.3.1', version: '18.3.0', unsupported: true },
        { min: '18.3.0', version: '18.3.1', unsupported: false },
        { min: '18.3.0', version: '18.3.0', unsupported: false },
        { min: '18.3', version: '18.3.0', unsupported: false },
        { min: '18.3', version: '18.3.1', unsupported: false },
        { min: '18', version: '18.3.1', unsupported: false },
        { min: '18', version: '18', unsupported: false },
        { min: 'b', version: 'a', unsupported: undefined },
        { min: '18.3', version: '18.3', unsupported: false },
        { min: '18.3', version: '18.4', unsupported: false },
        { min: '18.3', version: '18.2', unsupported: true },

        // if it's undefined, we can't say anything...
        { min: '18.3', version: undefined!, unsupported: undefined },
        { min: '18.3', version: '', unsupported: undefined },

        // more fun stuff
        { min: '7', version: 'latest', unsupported: undefined },
        { min: '7', version: '>=7', unsupported: false },
        { min: '7', version: '>7', unsupported: true }
    ] as const;
    it.each(combinationsMinimumRequirement)(
        '(min $min, version $version) => unsupported: $unsupported',
        ({ min, version, unsupported }) => {
            expect(minimumRequirement(min).for(version)).toEqual(unsupported);
        }
    );
});
