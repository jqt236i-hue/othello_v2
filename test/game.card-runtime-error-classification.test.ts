import {
  assertCardRuntimeCapability,
  CARD_RUNTIME_UNAVAILABLE_CODE,
  createCardRuntimeUnavailableError,
  isCardRuntimeUnavailableError
} from '../game/logic/card-runtime-errors';
import { runCardRuntimeBoundaryCheck } from '../scripts/check-card-runtime-boundary';
import * as path from 'path';

describe('card runtime unavailable classification', () => {
  test('accepts only the canonical branded transport shape', () => {
    const error = createCardRuntimeUnavailableError('targeting.targetResolver', 'targeting');
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: 'CardRuntimeUnavailableError',
      code: CARD_RUNTIME_UNAVAILABLE_CODE,
      capability: 'targeting.targetResolver',
      cohort: 'targeting'
    });
    expect(isCardRuntimeUnavailableError(error)).toBe(true);
    expect(Object.keys(error)).toEqual(['code', 'capability', 'cohort']);

    const transported = new Error(error.message) as any;
    Object.defineProperties(transported, {
      name: { value: 'CardRuntimeUnavailableError', configurable: true },
      code: { value: 'runtime_unavailable', enumerable: true },
      capability: { value: 'targeting.targetResolver', enumerable: true },
      cohort: { value: 'targeting', enumerable: true },
      [Symbol.for('card-reversi.card-runtime-unavailable.v1')]: {
        value: 'card-runtime-unavailable:v1',
        enumerable: false,
        configurable: false,
        writable: false
      }
    });
    expect(isCardRuntimeUnavailableError(transported)).toBe(true);
  });

  test('rejects message, code, plain-object, and mutable-brand spoofs', () => {
    expect(isCardRuntimeUnavailableError(new Error('runtime_unavailable'))).toBe(false);
    expect(isCardRuntimeUnavailableError({
      name: 'CardRuntimeUnavailableError',
      code: 'runtime_unavailable',
      capability: 'x',
      cohort: 'y'
    })).toBe(false);

    const mutableBrand = new Error('spoof') as any;
    mutableBrand.name = 'CardRuntimeUnavailableError';
    mutableBrand.code = 'runtime_unavailable';
    mutableBrand.capability = 'x';
    mutableBrand.cohort = 'y';
    mutableBrand[Symbol.for('card-reversi.card-runtime-unavailable.v1')] = 'card-runtime-unavailable:v1';
    expect(isCardRuntimeUnavailableError(mutableBrand)).toBe(false);
  });

  test('required assertions create the tag, while ordinary values and errors do not', () => {
    expect(() => assertCardRuntimeCapability({}, 'value')).not.toThrow();
    let caught: unknown;
    try {
      assertCardRuntimeCapability(null, 'marker.markers', 'marker');
    } catch (error) {
      caught = error;
    }
    expect(isCardRuntimeUnavailableError(caught)).toBe(true);
    expect(isCardRuntimeUnavailableError(new TypeError('programming error'))).toBe(false);
  });

  test('structural checker keeps constructor ownership and catch retagging closed', () => {
    const report = runCardRuntimeBoundaryCheck(path.resolve(__dirname, '..'));
    expect(report).toMatchObject({
      canonicalRuntimeDiscoveryEdges: 0,
      canonicalStaticRequireEdges: 0,
      canonicalUnresolvedRelativeEdges: 0,
      canonicalLegacyLookups: 0,
      canonicalCompatibilityEntryEdges: 0,
      canonicalWholeFacadeCaches: 0
    });
    expect(report.negativeFixtures).toContain('catchRetag');
    expect(report.negativeFixtures).toContain('canonicalCompatibilityEntryImport');
    expect(report.negativeFixtures).toHaveLength(8);
  });
});
