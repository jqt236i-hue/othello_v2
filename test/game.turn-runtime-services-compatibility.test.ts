import TurnPipelineFactory = require('../game/turn/turn_pipeline_factory');
import {
  createTurnRuntimeServices,
  assertTurnRuntimeServices
} from '../game/turn/turn-runtime-services';
import { isCardRuntimeUnavailableError } from '../game/logic/card-runtime-errors';

function createRequiredPorts() {
  return {
    cardLogic: {
      flushPresentationEvents: jest.fn(() => []),
      getCardContext: jest.fn(() => ({})),
      hasUsableCard: jest.fn(() => false),
      applyCardUsage: jest.fn()
    },
    core: {
      BLACK: 1,
      WHITE: -1,
      getLegalMoves: jest.fn(() => [])
    },
    phases: {
      applyTurnStartPhase: jest.fn(() => null),
      applyCardUsagePhase: jest.fn(),
      applyActionPhase: jest.fn()
    },
    deepClone: (value: any) => value,
    normalizePlayerKey: (player: unknown) => String(player),
    computeStateHash: () => null
  };
}

describe('turn runtime service compatibility', () => {
  test('keeps BoardOps and sub-placement continuation optional with the existing fallback', () => {
    const ports = createRequiredPorts();
    const pipeline = TurnPipelineFactory.createTurnPipelineModule({
      CardLogic: ports.cardLogic,
      Core: ports.core,
      TurnPipelinePhases: ports.phases,
      deepClone: ports.deepClone,
      normalizePlayerKey: ports.normalizePlayerKey,
      computeStateHash: ports.computeStateHash
    });
    const cardState: Record<string, unknown> = {};
    ports.phases.applyActionPhase.mockImplementation(() => {
      expect(cardState._currentActionMeta).toMatchObject({ actionId: 'compat-action' });
    });

    expect(() => pipeline.applyTurn(
      cardState,
      { currentPlayer: 1 },
      'black',
      { type: 'place', actionId: 'compat-action' }
    )).not.toThrow();
    expect(ports.phases.applyTurnStartPhase).toHaveBeenCalledTimes(1);
    expect(cardState).not.toHaveProperty('_currentActionMeta');
  });

  test('accepts partial optional ports and keeps per-method fallbacks', () => {
    const ports = createRequiredPorts();
    const setActionContext = jest.fn();
    const pipeline = TurnPipelineFactory.createTurnPipelineModule({
      CardLogic: ports.cardLogic,
      Core: ports.core,
      TurnPipelinePhases: ports.phases,
      BoardOps: { setActionContext },
      SubPlacementContinuation: {},
      deepClone: ports.deepClone,
      normalizePlayerKey: ports.normalizePlayerKey,
      computeStateHash: ports.computeStateHash
    });
    const cardState: Record<string, unknown> = {};

    expect(() => pipeline.applyTurn(
      cardState,
      { currentPlayer: 1 },
      'black',
      { type: 'place', actionId: 'partial-port-action' }
    )).not.toThrow();
    expect(setActionContext).toHaveBeenCalledTimes(1);
    expect(ports.phases.applyTurnStartPhase).toHaveBeenCalledTimes(1);
    expect(cardState).not.toHaveProperty('_currentActionMeta');
  });

  test('rejects accessor slots without evaluating caller code', () => {
    const ports = createRequiredPorts();
    let cardLogicReads = 0;
    const input: Record<string, unknown> = {
      core: ports.core,
      phases: ports.phases,
      deepClone: ports.deepClone,
      normalizePlayerKey: ports.normalizePlayerKey,
      computeStateHash: ports.computeStateHash
    };
    Object.defineProperty(input, 'cardLogic', {
      enumerable: true,
      get: () => {
        cardLogicReads += 1;
        return ports.cardLogic;
      }
    });

    let caught: unknown;
    try {
      createTurnRuntimeServices(input as any);
    } catch (error) {
      caught = error;
    }

    expect(cardLogicReads).toBe(0);
    expect(isCardRuntimeUnavailableError(caught)).toBe(true);
  });

  test('rejects nested method accessors without evaluating caller code', () => {
    const ports = createRequiredPorts();
    let methodReads = 0;
    const core: Record<string, unknown> = {
      BLACK: 1,
      WHITE: -1
    };
    Object.defineProperty(core, 'getLegalMoves', {
      enumerable: true,
      get: () => {
        methodReads += 1;
        return jest.fn(() => []);
      }
    });
    let caught: unknown;

    try {
      createTurnRuntimeServices({ ...ports, core } as any);
    } catch (error) {
      caught = error;
    }

    expect(methodReads).toBe(0);
    expect(isCardRuntimeUnavailableError(caught)).toBe(true);
  });

  test.each(['BLACK', 'WHITE'] as const)('rejects a core missing the required %s constant', (constant) => {
    const ports = createRequiredPorts();
    const core = { ...ports.core } as Record<string, unknown>;
    delete core[constant];

    expect(() => createTurnRuntimeServices({ ...ports, core } as any))
      .toThrow(expect.objectContaining({ code: 'runtime_unavailable' }));
  });

  test('rejects core constant accessors without evaluating caller code', () => {
    const ports = createRequiredPorts();
    let constantReads = 0;
    const core: Record<string, unknown> = {
      WHITE: -1,
      getLegalMoves: ports.core.getLegalMoves
    };
    Object.defineProperty(core, 'BLACK', {
      enumerable: true,
      get: () => {
        constantReads += 1;
        return 1;
      }
    });

    expect(() => createTurnRuntimeServices({ ...ports, core } as any))
      .toThrow(expect.objectContaining({ code: 'runtime_unavailable' }));
    expect(constantReads).toBe(0);
  });

  test.each([
    ['unknown string key', { unexpectedState: { mutable: true } }],
    ['symbol key', { [Symbol('stateful-extra')]: true }]
  ])('rejects %s instead of retaining stateful extras', (_label, extra) => {
    const ports = createRequiredPorts();
    expect(() => createTurnRuntimeServices({ ...ports, ...extra } as any))
      .toThrow(expect.objectContaining({ code: 'runtime_unavailable' }));
  });

  test('turns reflection traps into a canonical unavailable result', () => {
    const hostile = new Proxy({}, {
      ownKeys: () => { throw new Error('ownKeys trap'); }
    });
    let caught: unknown;

    try {
      createTurnRuntimeServices(hostile as any);
    } catch (error) {
      caught = error;
    }

    expect(isCardRuntimeUnavailableError(caught)).toBe(true);
  });

  test('assertion validates frozen root slots without invoking Proxy get traps', () => {
    const services = createTurnRuntimeServices(createRequiredPorts() as any);
    let getTrapCalls = 0;
    const guarded = new Proxy(services, {
      get: () => {
        getTrapCalls += 1;
        throw new Error('get trap');
      }
    });

    expect(() => assertTurnRuntimeServices(guarded)).not.toThrow();
    expect(getTrapCalls).toBe(0);
  });

  test('assertion rejects a frozen graph with an invalid optional validator', () => {
    const bypass = Object.freeze({
      ...createRequiredPorts(),
      validateState: 'not-a-function'
    });

    expect(() => assertTurnRuntimeServices(bypass))
      .toThrow(expect.objectContaining({ code: 'runtime_unavailable' }));
  });

  test('returns the exact validated data-slot identities in a frozen graph', () => {
    const ports = createRequiredPorts();
    const services = createTurnRuntimeServices(ports as any);

    expect(services.cardLogic).toBe(ports.cardLogic);
    expect(Object.isFrozen(services)).toBe(true);
    expect(() => assertTurnRuntimeServices(services)).not.toThrow();
  });
});
