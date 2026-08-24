import * as crypto from 'crypto';

const CardLogic = require('../game/logic/cards');
const LegacyWrapper = require('../game/logic/cards.js');
const Fixture = require('./fixtures/card-runtime-parity-fixture.js');
const Expected = require('./fixtures/card-runtime-parity-expected.v1.json');
const OptionalPresentationExpected = require('./fixtures/card-runtime-optional-presentation-expected.v1.json');
const SelfplayRunner = require('../src/engine/selfplay-runner');
const SelfplayExpected = require('./fixtures/card-runtime-selfplay-expected.v1.json');
const CpuDecision = require('../game/cpu-decision');
const CpuExpected = require('./fixtures/card-runtime-cpu-expected.v1.json');

function sha256(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function observedBaseline(result: any) {
  return {
    fixtureVersion: result.fixtureVersion,
    overallDigest: sha256(result),
    canonicalDigest: sha256(result.canonical),
    prngLedgerDigest: sha256(result.prng.ledger),
    resultDigest: sha256(result.results),
    pendingDigest: sha256(result.pendingBeforeCancel),
    scenarioDigest: sha256(result.scenarioCoverage),
    runtimeProjectionInventory: result.canonical.runtimeProjectionInventory,
    prng: result.prng.state,
    eventTypes: result.canonical.presentationEvents.map((event: any) => event.type),
    heavenOffers: result.results.heavenOffers,
    pending: result.pendingBeforeCancel
  };
}

describe('fixed-seed card runtime parity fixture', () => {
  test('pins exact source state, events, pending identity, and full PRNG ledger', () => {
    const result = Fixture.run(CardLogic);
    expect(observedBaseline(result)).toEqual(Expected);
    expect(result.scenarioCoverage.value).toMatchObject({
      turnStart: { turnIndex: 1 },
      protection: { context: { permaProtectedStones: [{ row: 2, col: 2, owner: 1 }] } },
      expandedTopology: { targetAtTopRight: true }
    });
    expect(LegacyWrapper).toBe(CardLogic);
    expect(Fixture.run(LegacyWrapper)).toEqual(result);
  });

  test('independent same-seed games are exact but do not share state, events, pending, or PRNG ledgers', () => {
    const first = Fixture.run(CardLogic);
    const second = Fixture.run(CardLogic);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.canonical).not.toBe(first.canonical);
    expect(second.canonical.presentationEvents).not.toBe(first.canonical.presentationEvents);
    expect(second.pendingBeforeCancel).not.toBe(first.pendingBeforeCancel);
    expect(second.prng.ledger).not.toBe(first.prng.ledger);
  });

  test('pins the current Node/headless optional presentation branch without treating it as cross-lane parity', () => {
    const probe = Fixture.runOptionalPresentationProbe(CardLogic);
    expect(probe.eventTypes).toEqual(OptionalPresentationExpected.nodeWorkerEventTypes);
    expect(sha256(probe.board)).toBe(OptionalPresentationExpected.boardDigest);
    expect(sha256(probe.marker)).toBe(OptionalPresentationExpected.markerDigest);
    expect(probe.prng).toEqual(OptionalPresentationExpected.prng);
    expect(sha256(probe)).toBe(OptionalPresentationExpected.nodeWorkerDigest);
  });

  test('pins a deterministic two-ply production selfplay entry', () => {
    const probe = Fixture.runSmallSelfplayProbe(SelfplayRunner);
    expect(sha256(probe)).toBe(SelfplayExpected.digest);
    expect(probe.summary).toMatchObject(SelfplayExpected.summary);
    expect(probe.records).toHaveLength(SelfplayExpected.summary.plies);
  });

  test('pins a deterministic production CPU card-choice entry', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const probe = Fixture.runCpuDecisionProbe(CpuDecision, CardLogic);
      expect(sha256(probe)).toBe(CpuExpected.digest);
      expect(probe).toMatchObject({
        selected: {
          cardId: CpuExpected.cardId,
          cardDef: { type: CpuExpected.cardType },
          score: CpuExpected.score
        }
      });
      expect(probe.stateDelta).toEqual(CpuExpected.stateDelta);
      expect(probe.prng).toEqual(CpuExpected.prng);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
