import { expect, describe, it } from 'vitest';
import { versionSplit, minimumRequirement } from '../src/version';

describe('versionSplit', () => {
    const combinationsVersionSplit = [
        { version: '18.13.0', expected: { major: 18, minor: 13, patch: 0 } },
        { version: 'x.13.0', expected: { major: undefined, minor: 13, patch: 0 } },
        { version: '18.y.0', expected: { major: 18, minor: undefined, patch: 0 } },
        { version: '18.13.z', expected: { major: 18, minor: 13, patch: undefined } },
        { version: '18', expected: { major: 18, minor: undefined, patch: undefined } },
        { version: '18.13', expected: { major: 18, minor: 13, patch: undefined } },
        { version: 'invalid', expected: { major: undefined, minor: undefined, patch: undefined } }
    ];
    it.each(combinationsVersionSplit)(
        'should return the correct version for $version',
        ({ version, expected }) => {
            expect(versionSplit(version)).toEqual(expected);
        }
    );
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
