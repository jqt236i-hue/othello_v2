import PresentationEffectProfiles = require('../shared/presentation-effect-profiles');
import { dispatchPresentationPhase } from '../ui/presentation/dispatcher';
import {
  collectBoardSourceTrajectoryRequests,
  getBoardSourceTrajectoryIdsForTarget
} from '../ui/board-visual/source-trajectory';
import { dedupePixiFlipTargets } from '../ui/pixi/effects/flip';
import {
  BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY,
  BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES,
  BOARD_SOURCE_TRAJECTORY_DOM_BROWSER_BASELINE,
  BOARD_SOURCE_TRAJECTORY_LONG_RANGE_CLIP_FIXTURE,
  BOARD_SOURCE_TRAJECTORY_MULTI_TARGET_TRACE,
  normalizeBoardSourceTrajectoryTraceEntry,
  resolveBaselineDurationMs
} from './fixtures/board-source-trajectory-contract';

describe('board source trajectory Phase 0 baseline', () => {
  test('freezes the exact shared profiles and excludes target-local slash', () => {
    expect(BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES.map((fixture) => fixture.profileKey)).toEqual([
      'sniperShot',
      'robotVacuumSuck',
      'destroyDragonBreath',
      'meteorGodBlackBeam',
      'lightningDestroyed',
      'udgDestroyed',
      'fireWillFlameBeam',
      'waterWillHealingBeam',
      'grassWillSeedBeam',
      'zombieBite'
    ]);
    expect(Object.isFrozen(BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES)).toBe(true);
    expect(BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY).not.toHaveProperty('willHunterKingSlash');
    expect(PresentationEffectProfiles.getSpecialDestroyTargetProfileKey({
      cause: 'WILL_HUNTER_KING',
      reason: 'will_hunter_king_slash'
    })).not.toBe('sniperShot');
  });

  test.each(BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES.filter((fixture) => fixture.eventType === 'destroy'))(
    '$profileKey matches the current shared cause/reason classifier',
    (fixture) => {
      expect(PresentationEffectProfiles.getSpecialDestroyTargetProfileKey({
        cause: fixture.cause,
        reason: fixture.reason
      })).toBe(fixture.profileKey);
      expect(PresentationEffectProfiles.requiresGlobalDestroyPrelude({
        cause: fixture.cause,
        reason: fixture.reason
      })).toBe(true);
    }
  );

  test('pins distance timing clamps, fixed timing, direction, ownership, and motion policy', () => {
    expect(resolveBaselineDurationMs(BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY.sniperShot, 0)).toBe(120);
    expect(resolveBaselineDurationMs(BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY.sniperShot, 2000)).toBe(420);
    expect(resolveBaselineDurationMs(BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY.robotVacuumSuck, 256)).toBe(212);
    expect(resolveBaselineDurationMs(BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY.destroyDragonBreath, 256)).toBe(312);
    expect(resolveBaselineDurationMs(BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY.meteorGodBlackBeam, 256)).toBe(286);
    expect(resolveBaselineDurationMs(BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY.lightningDestroyed, 256)).toBe(201);
    expect(resolveBaselineDurationMs(BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY.fireWillFlameBeam, 256)).toBe(312);
    expect(resolveBaselineDurationMs(BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY.waterWillHealingBeam, 256)).toBe(312);
    expect(resolveBaselineDurationMs(BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY.grassWillSeedBeam, 256)).toBe(312);
    expect(resolveBaselineDurationMs(BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY.zombieBite, 9999)).toBe(800);
    expect(BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY.robotVacuumSuck.direction).toBe('target-to-source');
    expect(BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY.sniperShot.ownerPolicy).toBe(
      'projectileOwner>meta.projectileOwner>opposite(ownerBefore)>black'
    );
    expect(BOARD_SOURCE_TRAJECTORY_BASELINE_BY_KEY.zombieBite.reducedMotion).toBe('skip-source');
    expect(BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES.every((fixture) => (
      fixture.targetImpactOwner === 'board-backend'
      && fixture.noAnimation === 'zero-duration-no-object'
    ))).toBe(true);
  });

  test('normalizes old and new route diagnostics without changing semantic order', () => {
    expect([
      'global:destroy_source_animation:sniperShot:0:0',
      'global:zombie_bite_source_animation:zombieBite:0:1',
      'backend:source-trajectory:robotVacuumSuck:0:2'
    ].map(normalizeBoardSourceTrajectoryTraceEntry)).toEqual([
      'trajectory:start:sniperShot:0:0',
      'trajectory:start:zombieBite:0:1',
      'trajectory:start:robotVacuumSuck:0:2'
    ]);
  });

  test('starts every raw destroy trajectory before the first board impact and gates each target', async () => {
    const trace: string[] = [];
    const resolvers = new Map<string, () => void>();
    const promises = new Map<string, Promise<void>>();
    const sniper = {
      r: 0, col: 0, sourceRow: 1, sourceCol: 1,
      cause: 'SNIPER_WILL', reason: 'sniper_shot'
    };
    const robot = {
      r: 0, col: 2, sourceRow: 2, sourceCol: 2,
      cause: 'ROBOT_VACUUM', reason: 'robot_vacuum_suck'
    };
    const event = { type: 'destroy', phase: 4, targets: [sniper, robot] };
    const dispatch = dispatchPresentationPhase([event], {
      playGlobalEvent: jest.fn(),
      async playBoardPhase(events, scope) {
        const batch = collectBoardSourceTrajectoryRequests(scope?.events || events, scope);
        for (const request of batch.requests) {
          const key = `${request.profileKey}:${request.target.row}:${request.target.col}`;
          trace.push(`trajectory:start:${key}`);
          promises.set(request.trajectoryId, new Promise<void>((resolve) => resolvers.set(key, () => {
            trace.push(`trajectory:settle:${key}`);
            resolve();
          })));
        }
        trace.push('board:impact:first');
        const ids = (events[0].targets || []).flatMap((target) => (
          getBoardSourceTrajectoryIdsForTarget(batch, 'destroy', target, events[0])
        ));
        await Promise.all(ids.map((trajectoryId) => promises.get(trajectoryId)));
        trace.push('board:commit');
      }
    });

    await Promise.resolve();
    expect(trace).toEqual(BOARD_SOURCE_TRAJECTORY_MULTI_TARGET_TRACE.slice(0, 3));
    resolvers.get('sniperShot:0:0')?.();
    await Promise.resolve();
    resolvers.get('robotVacuumSuck:0:2')?.();
    await dispatch;
    expect(trace).toEqual(BOARD_SOURCE_TRAJECTORY_MULTI_TARGET_TRACE);
  });

  test('records backend-owned raw zombie launches before coordinate dedupe', async () => {
    const first = {
      r: 3, col: 4, ownerBefore: 'black',
      cause: 'ZOMBIE', reason: 'zombie_infection',
      meta: { sourceRow: 3, sourceCol: 3 }
    };
    const second = {
      r: 3, col: 4, ownerAfter: 'white',
      cause: 'ZOMBIE', reason: 'zombie_infection',
      meta: { sourceRow: 3, sourceCol: 2 }
    };
    const rawStarts: unknown[] = [];
    let mergedTrajectoryIds: readonly string[] = [];
    let boardDedupeCount = 0;
    await dispatchPresentationPhase([{ type: 'flip', phase: 5, targets: [first, second] }], {
      playGlobalEvent: jest.fn(),
      async playBoardPhase(events, scope) {
        const batch = collectBoardSourceTrajectoryRequests(scope?.events || events, scope);
        rawStarts.push(...batch.requests.map((request) => request.targetPayload));
        const rawTargets = events.flatMap((event) => event.targets || []);
        const dedupedTargets = dedupePixiFlipTargets(rawTargets);
        boardDedupeCount = dedupedTargets.length;
        mergedTrajectoryIds = getBoardSourceTrajectoryIdsForTarget(
          batch,
          'flip',
          dedupedTargets[0],
          events[0]
        );
      }
    });
    expect(rawStarts).toEqual([first, second]);
    expect(boardDedupeCount).toBe(1);
    expect(mergedTrajectoryIds).toHaveLength(2);
  });

  test('records long-range sniper as logical endpoint preservation plus visible-owner clipping', () => {
    expect(BOARD_SOURCE_TRAJECTORY_LONG_RANGE_CLIP_FIXTURE).toEqual(expect.objectContaining({
      source: { row: 0, col: 0 },
      target: { row: 15, col: 15 },
      expectedLegacyOverflow: true,
      expectedPixiPolicy: 'clip-centerline-to-board-viewport-halo-to-two-cell-gutter'
    }));
  });

  test('keeps the measured desktop/mobile time-union baseline machine-readable', () => {
    expect(BOARD_SOURCE_TRAJECTORY_DOM_BROWSER_BASELINE.captures.map((capture) => (
      `${capture.viewport}:${capture.dpr}`
    ))).toEqual(['desktop-dpr1:1', 'mobile-dpr2:2']);
    for (const capture of BOARD_SOURCE_TRAJECTORY_DOM_BROWSER_BASELINE.captures) {
      const normalProfiles = capture.samples
        .filter((sample) => sample[1] === 'normal')
        .map((sample) => sample[0]);
      expect(normalProfiles).toEqual(BOARD_SOURCE_TRAJECTORY_BASELINE_FIXTURES
        .filter((fixture) => ![
          'fireWillFlameBeam',
          'waterWillHealingBeam',
          'grassWillSeedBeam'
        ].includes(fixture.profileKey))
        .map((fixture) => fixture.profileKey));
      const longRange = capture.samples.find((sample) => sample[1] === 'long-range-offscreen-sniper');
      expect(longRange?.[0]).toBe('sniperShot');
      expect(longRange?.[5]).toBe(true);
    }
  });
});
