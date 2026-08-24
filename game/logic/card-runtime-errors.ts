const CARD_RUNTIME_UNAVAILABLE_BRAND = Symbol.for('card-reversi.card-runtime-unavailable.v1');
const CARD_RUNTIME_UNAVAILABLE_BRAND_VALUE = 'card-runtime-unavailable:v1';

export const CARD_RUNTIME_UNAVAILABLE_CODE = 'runtime_unavailable' as const;

export interface CardRuntimeUnavailableShape extends Error {
    readonly code: typeof CARD_RUNTIME_UNAVAILABLE_CODE;
    readonly capability: string;
    readonly cohort: string;
}

const locallyCreatedRuntimeFailures = new WeakSet<object>();

/**
 * Canonical constructor for missing required runtime capabilities.
 *
 * The hidden Symbol.for field is a cross-bundle transport brand. It is not a
 * provenance or security boundary; producer ownership is enforced by the
 * card-runtime boundary checker and code review.
 */
export function createCardRuntimeUnavailableError(
    capabilityValue: unknown,
    cohortValue: unknown = 'canonical-card-runtime'
): CardRuntimeUnavailableShape {
    const capability = String(capabilityValue || '').trim();
    const cohort = String(cohortValue || '').trim();
    if (!capability) throw new TypeError('card runtime capability is required');
    if (!cohort) throw new TypeError('card runtime cohort is required');
    const error = new Error(`required card runtime capability is unavailable: ${capability}`) as CardRuntimeUnavailableShape;
    Object.defineProperties(error, {
        name: { value: 'CardRuntimeUnavailableError', configurable: true },
        code: { value: CARD_RUNTIME_UNAVAILABLE_CODE, enumerable: true },
        capability: { value: capability, enumerable: true },
        cohort: { value: cohort, enumerable: true },
        [CARD_RUNTIME_UNAVAILABLE_BRAND]: {
            value: CARD_RUNTIME_UNAVAILABLE_BRAND_VALUE,
            enumerable: false,
            configurable: false,
            writable: false
        }
    });
    locallyCreatedRuntimeFailures.add(error);
    return error;
}

export function isCardRuntimeUnavailableError(value: unknown): value is CardRuntimeUnavailableShape {
    if (!value || typeof value !== 'object') return false;
    if (locallyCreatedRuntimeFailures.has(value)) return true;
    const candidate = value as Record<PropertyKey, unknown>;
    const brand = Object.getOwnPropertyDescriptor(candidate, CARD_RUNTIME_UNAVAILABLE_BRAND);
    return Object.prototype.toString.call(candidate) === '[object Error]'
        && candidate.name === 'CardRuntimeUnavailableError'
        && candidate.code === CARD_RUNTIME_UNAVAILABLE_CODE
        && typeof candidate.capability === 'string'
        && candidate.capability.length > 0
        && typeof candidate.cohort === 'string'
        && candidate.cohort.length > 0
        && !!brand
        && brand.value === CARD_RUNTIME_UNAVAILABLE_BRAND_VALUE
        && brand.enumerable === false
        && brand.configurable === false
        && brand.writable === false;
}

export function assertCardRuntimeCapability<T>(
    value: T,
    capability: string,
    cohort?: string
): asserts value is NonNullable<T> {
    if (value === null || typeof value === 'undefined') {
        throw createCardRuntimeUnavailableError(capability, cohort);
    }
}

