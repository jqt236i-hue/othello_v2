import PresentationEffectProfiles = require('../shared/presentation-effect-profiles');
import * as VisualSeed from '../ui/presentation/visual-seed';
import { dedupePixiFlipTargets } from '../ui/pixi/effects/flip';
import {
  BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY,
  BoardSourceTrajectoryError,
  collectBoardSourceTrajectoryRequests,
  getBoardSourceTrajectoryIdsForTarget,
  getBoardSourceTrajectoryRequest,
  resolveBoardSourceTrajectoryDurationMs
} from '../ui/board-visual/source-trajectory';
import {
  BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES
} from './fixtures/board-source-trajectory-contract';

describe('board source trajectory typed contract', () => {
  test('registers exactly the shared seven profiles and matches the Phase 0 contract', () => {
    expect(new Set(Object.keys(BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY))).toEqual(
      new Set(PresentationEffectProfiles.BOARD_SOURCE_TRAJECTORY_PROFILE_KEYS)
    );
    expect(new Set(Object.keys(BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY))).toEqual(
      new Set(BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES.map((fixture) => fixture.profileKey))
    );
    for (const fixture of BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES) {
      const profile = BOARD_SOURCE_TRAJECTORY_PROFILE_REGISTRY[fixture.profileKey];
      expect(profile).toMatchObject({
        profileKey: fixture.profileKey,
        eventType: fixture.eventType,
        primitive: fixture.primitive,
        direction: fixture.direction,
        duration: fixture.duration,
        settlement: fixture.settlement,
        deadlinePaddingMs: fixture.deadlinePaddingMs,
        targetImpactOwner: fixture.targetImpactOwner,
        noAnimation: fixture.noAnimation,
        reducedMotion: fixture.reducedMotion
      });
      expect(profile.haloCells).toBeLessThanOrEqual(2);
      expect(Object.isFrozen(profile)).toBe(true);
    }
  });

  test.each(BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES)(
    '$profileKey is classified only for its event type',
    (fixture) => {
      const target = {
        cause: fixture.cause,
        reason: fixture.reason
      };
      expect(PresentationEffectProfiles.getBoardSourceTrajectoryProfileKey(
        fixture.eventType,
        target
      )).toBe(fixture.profileKey);
      expect(PresentationEffectProfiles.getBoardSourceTrajectoryProfileKey(
        fixture.eventType === 'destroy' ? 'flip' : 'destroy',
        target
      )).toBeNull();
    }
  );

  test('enumerates raw events and targets in received order with stable phase-local ids', () => {
    const ignored = { r: 3, col: 3, cause: 'SYSTEM', reason: 'ordinary' };
    const sniper = {
      r: -2, col: 11, sourceRow: -3, sourceCol: 10,
      cause: 'SNIPER_WILL', reason: 'sniper_shot', ownerBefore: 'white'
    };
    const robot = {
      r: 4, col: 4, sourceRow: 6, sourceCol: 6,
      cause: 'ROBOT_VACUUM', reason: 'robot_vacuum_suck', ownerBefore: 'white'
    };
    const zombie = {
      r: 2, col: 5, ownerAfter: 'black',
      cause: 'ZOMBIE', reason: 'zombie_infection',
      meta: { sourceRow: 2, sourceCol: 4 }
    };
    const events = [
      { type: 'destroy', targets: [ignored, sniper, robot] },
      { type: 'flip', targets: [zombie] }
    ];
    const batch = collectBoardSourceTrajectoryRequests(events, { phaseKey: 'turn:4', stepIndex: 2 });

    expect(batch.requests.map((request) => request.profileKey)).toEqual([
      'sniperShot', 'robotVacuumSuck', 'zombieBite'
    ]);
    expect(batch.requests.map((request) => request.trajectoryId)).toEqual([
      'turn%3A4/2/0/1/sniperShot',
      'turn%3A4/2/0/2/robotVacuumSuck',
      'turn%3A4/2/1/0/zombieBite'
    ]);
    expect(batch.requests[0]).toMatchObject({
      source: { row: -3, col: 10 },
      target: { row: -2, col: 11 },
      owner: 'black',
      direction: 'source-to-target',
      event: events[0],
      targetPayload: sniper
    });
    expect(batch.requests[1]).toMatchObject({ owner: 'white', direction: 'target-to-source' });
    expect(batch.requests[2]).toMatchObject({ owner: 'black', direction: 'source-to-target' });
    expect(Object.isFrozen(batch)).toBe(true);
    expect(Object.isFrozen(batch.requests)).toBe(true);
    expect(Object.isFrozen(batch.requests[0].source)).toBe(true);
    expect(getBoardSourceTrajectoryRequest(batch, batch.requests[1].trajectoryId)).toBe(batch.requests[1]);
  });

  test.each([
    [{ projectileOwner: 'white', ownerBefore: 'white' }, 'white'],
    [{ meta: { projectileOwner: 'white' }, ownerBefore: 'white' }, 'white'],
    [{ ownerBefore: 'black' }, 'white'],
    [{ ownerBefore: 'white' }, 'black'],
    [{}, 'black']
  ])('uses the exact sniper projectile owner fallback chain', (ownerFields, expectedOwner) => {
    const target = {
      r: 1, col: 1, sourceRow: 0, sourceCol: 0,
      cause: 'SNIPER_WILL', reason: 'sniper_shot',
      ...ownerFields
    };
    const batch = collectBoardSourceTrajectoryRequests([{ type: 'destroy', targets: [target] }]);
    expect(batch.requests[0].owner).toBe(expectedOwner);
  });

  test('truncates finite source coordinates without relaxing target-coordinate validation', () => {
    const event = {
      type: 'destroy',
      targets: [{
        r: 3,
        col: 4,
        sourceRow: 1.9,
        sourceCol: -2.7,
        cause: 'SNIPER_WILL',
        reason: 'sniper_shot',
        ownerBefore: 'white'
      }]
    };

    expect(collectBoardSourceTrajectoryRequests([event]).requests[0]).toMatchObject({
      source: { row: 1, col: -2 },
      target: { row: 3, col: 4 }
    });
    expect(() => collectBoardSourceTrajectoryRequests([{
      ...event,
      targets: [{ ...event.targets[0], r: 3.5 }]
    }])).toThrow(expect.objectContaining<Partial<BoardSourceTrajectoryError>>({
      code: 'invalid_target_coordinate'
    }));
  });

  test('maps every raw zombie request to one coordinate-deduped target in raw order', () => {
    const first = {
      r: 3, col: 4, ownerBefore: 'black',
      cause: 'ZOMBIE', reason: 'zombie_infection',
      meta: { sourceRow: 3, sourceCol: 2 }
    };
    const second = {
      r: 3, col: 4, ownerAfter: 'white',
      cause: 'ZOMBIE', reason: 'zombie_infection',
      meta: { sourceRow: 3, sourceCol: 1 }
    };
    const event = { type: 'flip', targets: [first, second] };
    const batch = collectBoardSourceTrajectoryRequests([event], { phaseKey: 'zombie', stepIndex: 0 });
    const deduped = dedupePixiFlipTargets(event.targets);

    expect(batch.requests).toHaveLength(2);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]).not.toBe(first);
    expect(deduped[0]).not.toBe(second);
    expect(getBoardSourceTrajectoryIdsForTarget(batch, 'flip', deduped[0])).toEqual(
      batch.requests.map((request) => request.trajectoryId)
    );
  });

  test('uses the existing presentation-only lightning seed without Math.random or game RNG', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used');
    });
    const gameRng = jest.fn();
    const event = {
      type: 'destroy',
      visualSeq: 91,
      sequenceIndex: 5,
      actionId: 'action-4',
      effectBlockId: 'block-2',
      targets: [{
        r: 6, col: 7, sourceRow: 1, sourceCol: 2,
        cause: 'ULTIMATE_DESTROY_GOD', reason: 'udg_destroyed'
      }]
    };
    const first = collectBoardSourceTrajectoryRequests([event]);
    const second = collectBoardSourceTrajectoryRequests([event]);
    const expected = VisualSeed.createVisualSeed({
      event: {
        ...event,
        presentationBatchId: 'local-presentation:0',
        effectKind: 'destroy-source',
        target: { row: 6, col: 7 }
      }
    });
    expect(first.requests[0].visualSeed).toBe(expected);
    expect(second.requests[0].visualSeed).toBe(expected);
    expect(randomSpy).not.toHaveBeenCalled();
    expect(gameRng).not.toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  test('fails typed preflight for known profiles with incomplete geometry', () => {
    expect(() => collectBoardSourceTrajectoryRequests([{
      type: 'destroy',
      targets: [{ r: 2, col: 2, cause: 'SNIPER_WILL', reason: 'sniper_shot' }]
    }])).toThrow(expect.objectContaining<Partial<BoardSourceTrajectoryError>>({
      name: 'BoardSourceTrajectoryError',
      code: 'invalid_source_coordinate',
      profileKey: 'sniperShot',
      eventOrdinal: 0,
      targetOrdinal: 0
    }));
    expect(() => collectBoardSourceTrajectoryRequests([{
      type: 'flip',
      targets: [{ sourceRow: 1, sourceCol: 1, cause: 'ZOMBIE', reason: 'zombie_infection' }]
    }])).toThrow(expect.objectContaining<Partial<BoardSourceTrajectoryError>>({
      code: 'invalid_target_coordinate',
      profileKey: 'zombieBite'
    }));
  });

  test('keeps current duration formulas in the renderer-independent registry', () => {
    for (const fixture of BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES) {
      const distance = 256;
      const raw = fixture.duration.baseMs + distance * fixture.duration.distanceFactor;
      const expected = Math.max(
        fixture.duration.minMs,
        Math.min(fixture.duration.maxMs, Math.round(raw))
      );
      expect(resolveBoardSourceTrajectoryDurationMs(fixture.profileKey, distance)).toBe(expected);
    }
  });
});
