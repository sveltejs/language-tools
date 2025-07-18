import { expect, describe, it } from 'vitest';
import { atLeast } from '../src/version';

describe.only('atLeast', () => {
    const combinationsAtLeast = [
        { min: '5', version: '>=5', supported: true },
        { min: '5', version: '>=5.0.0', supported: true },
        { min: '5', version: '5.0.0', supported: true },
        { min: '5', version: '5', supported: true },
        { min: '5', version: '4', supported: false },
        { min: '5', version: '4.9', supported: false },
        { min: '5', version: '', supported: undefined },
        { min: '5', version: 'catalog:', supported: undefined },
        { min: '5', version: 'latest', supported: undefined },
        { min: '5', version: 'latest', supported: true, fallback: true }
    ];
    it.each(combinationsAtLeast)(
        '(min $min, version $version) => supported: $supported',
        ({ min, version, supported, fallback }) => {
            expect(
                atLeast({
                    packageName: 'myPkg',
                    versionMin: min,
                    versionToCheck: version,
                    fallback
                })
            ).toEqual(supported);
        }
    );
});
