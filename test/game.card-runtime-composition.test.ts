import * as fs from 'fs';
import * as path from 'path';
import {
  CARD_RUNTIME_REQUIRED_EXPORTS,
  CARD_RUNTIME_SERVICE_KEYS,
  assertCardRuntimeServices,
  createCardRuntimeServices,
  type CardRuntimeServices
} from '../game/logic/card-runtime-contracts';
import {
  composeDefaultCardRuntimeServices,
  getDefaultCardRuntimeServices
} from '../game/logic/card-runtime-composer';
import { isCardRuntimeUnavailableError } from '../game/logic/card-runtime-errors';
import createCardLogicRuntime = require('../game/logic/cards-runtime-factory');

const CardLogic = require('../game/logic/cards');
const parityFixture = require('./fixtures/card-runtime-parity-fixture.js');

function cloneServiceInput(services: CardRuntimeServices): any {
  return Object.fromEntries(
    Object.entries(services).map(([cohort, group]) => [cohort, { ...group }])
  );
}

function replaceServiceExport(
  input: any,
  cohort: string,
  service: string,
  exportName: string,
  value: unknown
): void {
  input[cohort][service] = Object.freeze({
    ...input[cohort][service],
    [exportName]: value
  });
}

function captureRuntimeError(run: () => unknown): any {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(isCardRuntimeUnavailableError(caught)).toBe(true);
  return caught;
}

describe('card runtime static composition', () => {
  test('constructs one complete shallow-frozen service graph', () => {
    const first = getDefaultCardRuntimeServices();
    const second = getDefaultCardRuntimeServices();
    const separatelyComposed = composeDefaultCardRuntimeServices();

    expect(first).toBe(second);
    expect(separatelyComposed).not.toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    for (const [cohort, requiredKeys] of Object.entries(CARD_RUNTIME_SERVICE_KEYS)) {
      const group = first[cohort as keyof CardRuntimeServices] as Record<string, unknown>;
      expect(Object.isFrozen(group)).toBe(true);
      expect(Object.keys(group)).toEqual(expect.arrayContaining([...requiredKeys]));
      for (const key of requiredKeys) expect(group[key]).toBeDefined();
    }
  });

  test('rejects a missing capability before invoking any supplied module', () => {
    const input = cloneServiceInput(getDefaultCardRuntimeServices());
    const calls: string[] = [];
    input.state.stateFactory = Object.freeze({
      createCardState: () => calls.push('createCardState'),
      copyCardState: () => calls.push('copyCardState')
    });
    delete input.targeting.targetResolver;

    let caught: unknown;
    try {
      createCardRuntimeServices(input);
    } catch (error) {
      caught = error;
    }

    expect(isCardRuntimeUnavailableError(caught)).toBe(true);
    expect(caught).toMatchObject({
      code: 'runtime_unavailable',
      capability: 'targeting.targetResolver',
      cohort: 'targeting'
    });
    expect(calls).toEqual([]);
  });

  test.each([
    [{ placeholder: true }, 'state.handAccess.createCardHandAccess'],
    [{ createCardHandAccess: true }, 'state.handAccess.createCardHandAccess']
  ])('rejects an incomplete module export surface before factory activation', (replacement, capability) => {
    const input = cloneServiceInput(getDefaultCardRuntimeServices());
    input.state.handAccess = Object.freeze(replacement);

    let caught: unknown;
    try {
      createCardRuntimeServices(input);
    } catch (error) {
      caught = error;
    }

    expect(isCardRuntimeUnavailableError(caught)).toBe(true);
    expect(caught).toMatchObject({
      code: 'runtime_unavailable',
      capability,
      cohort: 'state'
    });

    const bypass = Object.freeze({
      ...input,
      state: Object.freeze(input.state)
    });
    expect(() => createCardLogicRuntime(bypass as CardRuntimeServices)).toThrow(caught as Error);
  });

  test('rejects stateful invocation values and unknown root groups', () => {
    const stateful = cloneServiceInput(getDefaultCardRuntimeServices());
    stateful.pending.events = [];
    expect(() => createCardRuntimeServices(stateful)).toThrow(
      'stateful invocation value is forbidden in card runtime services: pending.events'
    );

    const unknown = cloneServiceInput(getDefaultCardRuntimeServices());
    unknown.room = Object.freeze({});
    expect(() => createCardRuntimeServices(unknown)).toThrow('unknown card runtime service group: room');
  });

  test('validates every required value slot and preserves legitimate terminal null values', () => {
    const valueSlots = Object.values(CARD_RUNTIME_REQUIRED_EXPORTS)
      .flatMap((group) => Object.values(group))
      .reduce((total, contract) => total + Object.keys(contract.values).length, 0);
    expect(valueSlots).toBe(24);

    const progression = getDefaultCardRuntimeServices().state.progression;
    expect(progression.THROW_CHAIN_CONFIG_BY_TYPE.INFINITE_PLACE.nextType).toBeNull();
    expect(progression.CHAIN_WILL_CONFIG_BY_TYPE.INFINITE_CHAIN_WILL.nextCardId).toBeNull();
  });

  test.each([
    ['state', 'sharedConstants', 'CARD_DEFS', null],
    ['state', 'sharedConstants', 'CARD_TYPE_BY_ID', {}],
    ['state', 'sharedConstants', 'BLACK', 2],
    ['state', 'sharedConstants', 'WHITE', -2],
    ['state', 'sharedConstants', 'EMPTY', 1],
    ['state', 'sharedConstants', 'DIRECTIONS', [[0, 0]]],
    ['state', 'sharedConstants', 'BOARD_SIZE', '8'],
    ['state', 'sharedConstants', 'CHARGE_MAX', 0],
    ['state', 'sharedConstants', 'INITIAL_BOARD_BONUS_DISTRIBUTION', [{ value: 999, count: 1 }]],
    ['state', 'sharedConstants', 'TIME_STOP_GOD_TURNS', 0],
    ['state', 'sharedConstants', 'TIME_STOP_GOD_CONSECUTIVE_TURNS', 0],
    ['state', 'sharedConstants', 'TIME_STOP_GOD_SELF_DESTROY_COUNT', 0],
    ['state', 'sharedConstants', 'TIME_STOP_DEITY_TURNS', 0],
    ['state', 'sharedConstants', 'TIME_STOP_DEITY_CONSECUTIVE_TURNS', 0],
    ['state', 'sharedConstants', 'TIME_STOP_DEITY_SELF_DESTROY_COUNT', 0],
    ['state', 'progression', 'THROW_CHAIN_CONFIG_BY_TYPE', {}],
    ['state', 'progression', 'CHAIN_WILL_CONFIG_BY_TYPE', {}],
    ['state', 'progression', 'CHAIN_WILL_CARD_TYPES', []],
    ['board', 'markersAdapter', 'MARKER_KINDS', {}],
    ['board', 'markersAdapter', 'MARKER_CATEGORIES', {}],
    ['marker', 'specialStoneRegistry', 'TEMPORARY_SPECIAL_CELL_TYPES', new Set()],
    ['marker', 'manifestStoneRegistry', 'MANIFEST_STONE_METADATA', {}],
    ['marker', 'markers', 'MARKER_KINDS', {}],
    ['marker', 'markers', 'MARKER_CATEGORIES', {}]
  ])('rejects malformed required value %s.%s.%s', (cohort, service, exportName, value) => {
    const input = cloneServiceInput(getDefaultCardRuntimeServices());
    replaceServiceExport(input, cohort, service, exportName, value);
    const caught = captureRuntimeError(() => createCardRuntimeServices(input));
    expect(caught).toMatchObject({
      code: 'runtime_unavailable',
      capability: `${cohort}.${service}.${exportName}`,
      cohort
    });
  });

  test('rejects semantically incomplete nested progression and manifest metadata', () => {
    const progressionInput = cloneServiceInput(getDefaultCardRuntimeServices());
    const brokenThrowConfig = Object.fromEntries(
      Object.entries(progressionInput.state.progression.THROW_CHAIN_CONFIG_BY_TYPE).map(([type, entry]: [string, any]) => {
        const clone = { ...entry };
        delete clone.infinite;
        delete clone.extraPlacements;
        return [type, clone];
      })
    );
    replaceServiceExport(
      progressionInput,
      'state',
      'progression',
      'THROW_CHAIN_CONFIG_BY_TYPE',
      brokenThrowConfig
    );
    expect(captureRuntimeError(() => createCardRuntimeServices(progressionInput))).toMatchObject({
      capability: 'state.progression.THROW_CHAIN_CONFIG_BY_TYPE',
      cohort: 'state'
    });

    const manifestInput = cloneServiceInput(getDefaultCardRuntimeServices());
    const sourceMetadata = manifestInput.marker.manifestStoneRegistry.MANIFEST_STONE_METADATA;
    const brokenMetadata = Object.fromEntries(
      Object.entries(sourceMetadata).map(([type, entry]: [string, any], index) => {
        if (index !== 0) return [type, entry];
        const clone = { ...entry, imagePathByOwner: { x: 'unexpected.png' } };
        delete clone.displayCategoryName;
        return [type, clone];
      })
    );
    replaceServiceExport(
      manifestInput,
      'marker',
      'manifestStoneRegistry',
      'MANIFEST_STONE_METADATA',
      brokenMetadata
    );
    expect(captureRuntimeError(() => createCardRuntimeServices(manifestInput))).toMatchObject({
      capability: 'marker.manifestStoneRegistry.MANIFEST_STONE_METADATA',
      cohort: 'marker'
    });
  });

  test('uses captured collection intrinsics without invoking supplied Set or Array methods', () => {
    let getterCalls = 0;
    const input = cloneServiceInput(getDefaultCardRuntimeServices());
    const temporaryTypes = new Set(input.marker.specialStoneRegistry.TEMPORARY_SPECIAL_CELL_TYPES);
    Object.defineProperty(temporaryTypes, 'size', {
      configurable: true,
      get() {
        getterCalls += 1;
        throw new Error('supplied Set size getter must not run');
      }
    });
    replaceServiceExport(
      input,
      'marker',
      'specialStoneRegistry',
      'TEMPORARY_SPECIAL_CELL_TYPES',
      temporaryTypes
    );

    const chainTypes = Array.from(input.state.progression.CHAIN_WILL_CARD_TYPES);
    Object.defineProperty(chainTypes, 'slice', {
      configurable: true,
      get() {
        getterCalls += 1;
        throw new Error('supplied Array slice getter must not run');
      }
    });
    replaceServiceExport(input, 'state', 'progression', 'CHAIN_WILL_CARD_TYPES', chainTypes);

    expect(() => createCardRuntimeServices(input)).not.toThrow();
    expect(getterCalls).toBe(0);
  });

  test('rejects inconsistent derived maps with an exact branded capability', () => {
    const input = cloneServiceInput(getDefaultCardRuntimeServices());
    replaceServiceExport(input, 'state', 'sharedConstants', 'CARD_TYPE_BY_ID', {
      ...input.state.sharedConstants.CARD_TYPE_BY_ID,
      normal_01: 'WRONG_TYPE'
    });
    const caught = captureRuntimeError(() => createCardRuntimeServices(input));
    expect(caught).toMatchObject({
      capability: 'state.sharedConstants.CARD_TYPE_BY_ID',
      cohort: 'state'
    });
  });

  test('preserves partial-catalog progression entries whose next card is absent', () => {
    const input = cloneServiceInput(getDefaultCardRuntimeServices());
    const throwConfig = Object.fromEntries(
      Object.entries(input.state.progression.THROW_CHAIN_CONFIG_BY_TYPE).map(([type, entry]: [string, any]) => [
        type,
        { ...entry }
      ])
    );
    throwConfig.DOUBLE_PLACE.nextCardId = null;
    throwConfig.DOUBLE_PLACE.nextName = null;
    throwConfig.TRIPLE_PLACE.cardId = null;
    throwConfig.TRIPLE_PLACE.name = 'TRIPLE_PLACE';
    replaceServiceExport(input, 'state', 'progression', 'THROW_CHAIN_CONFIG_BY_TYPE', throwConfig);

    expect(() => createCardRuntimeServices(input)).not.toThrow();
  });

  test('brands exceptions raised only during semantic relationship validation', () => {
    const input = cloneServiceInput(getDefaultCardRuntimeServices());
    let ownKeysCalls = 0;
    const trappedTypeById = new Proxy({ ...input.state.sharedConstants.CARD_TYPE_BY_ID }, {
      ownKeys(target) {
        ownKeysCalls += 1;
        if (ownKeysCalls >= 3) throw new Error('relationship trap');
        return Reflect.ownKeys(target);
      }
    });
    replaceServiceExport(input, 'state', 'sharedConstants', 'CARD_TYPE_BY_ID', trappedTypeById);

    const caught = captureRuntimeError(() => createCardRuntimeServices(input));
    expect(caught).toMatchObject({
      capability: 'state.sharedConstants.CARD_TYPE_BY_ID',
      cohort: 'state'
    });
  });

  test('brands root, group, and required-export descriptor reflection failures', () => {
    const rootInput = cloneServiceInput(getDefaultCardRuntimeServices());
    const trappedRoot = new Proxy(rootInput, {
      getOwnPropertyDescriptor() {
        throw new Error('root descriptor trap');
      }
    });
    expect(captureRuntimeError(() => createCardRuntimeServices(trappedRoot))).toMatchObject({
      capability: 'state',
      cohort: 'state'
    });

    const groupInput = cloneServiceInput(getDefaultCardRuntimeServices());
    groupInput.state = new Proxy(groupInput.state, {
      getOwnPropertyDescriptor() {
        throw new Error('group descriptor trap');
      }
    });
    expect(captureRuntimeError(() => createCardRuntimeServices(groupInput))).toMatchObject({
      capability: 'state.sharedConstants',
      cohort: 'state'
    });

    const moduleInput = cloneServiceInput(getDefaultCardRuntimeServices());
    let descriptorCalls = 0;
    moduleInput.state.stateFactory = new Proxy({ ...moduleInput.state.stateFactory }, {
      getOwnPropertyDescriptor(target, key) {
        descriptorCalls += 1;
        if (descriptorCalls >= 3) throw new Error('module descriptor trap');
        return Reflect.getOwnPropertyDescriptor(target, key);
      }
    });
    expect(captureRuntimeError(() => createCardRuntimeServices(moduleInput))).toMatchObject({
      capability: 'state.stateFactory.createCardState',
      cohort: 'state'
    });
  });

  test('rejects accessors at every service boundary without invoking them', () => {
    const defaultServices = getDefaultCardRuntimeServices();

    for (const layer of ['root', 'group', 'export', 'nested'] as const) {
      let getterCalls = 0;
      const input = cloneServiceInput(defaultServices);
      if (layer === 'root') {
        Object.defineProperty(input, 'state', {
          enumerable: true,
          get() {
            getterCalls += 1;
            throw new Error('root getter must not run');
          }
        });
      } else if (layer === 'group') {
        Object.defineProperty(input.state, 'sharedConstants', {
          enumerable: true,
          get() {
            getterCalls += 1;
            throw new Error('group getter must not run');
          }
        });
      } else if (layer === 'export') {
        const sharedConstants = { ...input.state.sharedConstants };
        Object.defineProperty(sharedConstants, 'CARD_DEFS', {
          enumerable: true,
          get() {
            getterCalls += 1;
            throw new Error('export getter must not run');
          }
        });
        input.state.sharedConstants = sharedConstants;
      } else {
        const definitions = input.state.sharedConstants.CARD_DEFS.slice();
        const first = { ...definitions[0] };
        Object.defineProperty(first, 'id', {
          enumerable: true,
          get() {
            getterCalls += 1;
            throw new Error('nested getter must not run');
          }
        });
        definitions[0] = first;
        replaceServiceExport(input, 'state', 'sharedConstants', 'CARD_DEFS', definitions);
      }

      const caught = captureRuntimeError(() => createCardRuntimeServices(input));
      expect(caught).toMatchObject({ code: 'runtime_unavailable' });
      expect(getterCalls).toBe(0);
    }
  });

  test('does not trust a manually frozen service graph that bypassed activation', () => {
    const input = cloneServiceInput(getDefaultCardRuntimeServices());
    replaceServiceExport(input, 'state', 'sharedConstants', 'BOARD_SIZE', '8');
    const bypass = Object.freeze(Object.fromEntries(
      Object.entries(input).map(([cohort, group]) => [cohort, Object.freeze(group)])
    )) as CardRuntimeServices;
    const caught = captureRuntimeError(() => createCardLogicRuntime(bypass));
    expect(caught).toMatchObject({
      capability: 'state.sharedConstants.BOARD_SIZE',
      cohort: 'state'
    });
  });

  test('brands frozen root and group introspection traps during bypass validation', () => {
    const services = getDefaultCardRuntimeServices();
    const trappedRoot = new Proxy(services, {
      getOwnPropertyDescriptor() {
        throw new Error('frozen root descriptor trap');
      }
    });
    expect(captureRuntimeError(() => assertCardRuntimeServices(trappedRoot))).toMatchObject({
      capability: 'card-runtime-services/activation',
      cohort: 'activation'
    });

    const trappedState = new Proxy(services.state, {
      getOwnPropertyDescriptor() {
        throw new Error('frozen group descriptor trap');
      }
    });
    const trappedGroup = Object.freeze({ ...services, state: trappedState });
    expect(captureRuntimeError(() => assertCardRuntimeServices(trappedGroup))).toMatchObject({
      capability: 'state/activation',
      cohort: 'activation'
    });
  });

  test('frozen bypass still rejects unknown root groups and stateful invocation extras', () => {
    const statefulInput = cloneServiceInput(getDefaultCardRuntimeServices());
    statefulInput.pending.events = [];
    const statefulBypass = Object.freeze(Object.fromEntries(
      Object.entries(statefulInput).map(([cohort, group]) => [cohort, Object.freeze(group)])
    )) as CardRuntimeServices;
    expect(() => createCardLogicRuntime(statefulBypass)).toThrow(
      'stateful invocation value is forbidden in card runtime services: pending.events'
    );

    const unknownInput = cloneServiceInput(getDefaultCardRuntimeServices());
    unknownInput.room = Object.freeze({ runtime: Object.freeze({ ready: true }) });
    const unknownBypass = Object.freeze(Object.fromEntries(
      Object.entries(unknownInput).map(([cohort, group]) => [cohort, Object.freeze(group)])
    )) as CardRuntimeServices;
    expect(() => createCardLogicRuntime(unknownBypass)).toThrow('unknown card runtime service group: room');
  });

  test('rejects enumerable, non-enumerable, and Symbol extras in activation and frozen bypass graphs', () => {
    const enumerableInput = cloneServiceInput(getDefaultCardRuntimeServices());
    enumerableInput.pending.unexpectedModule = Object.freeze({ ready: true });
    expect(() => createCardRuntimeServices(enumerableInput)).toThrow(
      'unknown card runtime service: pending.unexpectedModule'
    );

    const hiddenInput = cloneServiceInput(getDefaultCardRuntimeServices());
    Object.defineProperty(hiddenInput.pending, 'events', {
      value: [],
      enumerable: false,
      configurable: true
    });
    expect(() => createCardRuntimeServices(hiddenInput)).toThrow(
      'stateful invocation value is forbidden in card runtime services: pending.events'
    );

    const symbolInput = cloneServiceInput(getDefaultCardRuntimeServices());
    const unexpected = Symbol('unexpectedModule');
    symbolInput.pending[unexpected] = Object.freeze({ ready: true });
    expect(() => createCardRuntimeServices(symbolInput)).toThrow(
      'unknown card runtime service: pending.Symbol(unexpectedModule)'
    );

    const frozenInput = cloneServiceInput(getDefaultCardRuntimeServices());
    Object.defineProperty(frozenInput.pending, 'events', {
      value: [],
      enumerable: false
    });
    const frozenBypass = Object.freeze(Object.fromEntries(
      Object.entries(frozenInput).map(([cohort, group]) => [cohort, Object.freeze(group)])
    )) as CardRuntimeServices;
    expect(() => createCardLogicRuntime(frozenBypass)).toThrow(
      'stateful invocation value is forbidden in card runtime services: pending.events'
    );
  });

  test('factory and stable facade have exact healthy-runtime behavior and API shape', () => {
    const direct = createCardLogicRuntime(composeDefaultCardRuntimeServices());
    expect(Reflect.ownKeys(direct)).toEqual(Reflect.ownKeys(CardLogic));
    expect(parityFixture.run(direct)).toEqual(parityFixture.run(CardLogic));
  });

  test('keeps the factory free of composer/facade imports', () => {
    const root = path.resolve(__dirname, '..');
    const factory = fs.readFileSync(path.join(root, 'game', 'logic', 'cards-runtime-factory.ts'), 'utf8');
    const facade = fs.readFileSync(path.join(root, 'game', 'logic', 'cards.ts'), 'utf8');
    expect(factory).not.toMatch(/from ['"]\.\/card-runtime-composer['"]/);
    expect(factory).not.toMatch(/require\(['"]\.\/cards['"]\)/);
    expect(factory).not.toMatch(/CardRuntimeServices\.[A-Za-z]+\.[A-Za-z]+\s+as\s+any/);
    expect(facade).toContain("from './card-runtime-composer'");
    expect(facade).toContain("require('./cards-runtime-factory')");
  });
});
