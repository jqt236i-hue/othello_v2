import { createCpuPolicyDecisionContext } from '../game/ai/cpu-policy-decision-context';

describe('cpu-policy decision context module', () => {
  test('derives board stats and estimated disc counts when explicit values are missing', () => {
    const board = [
      [0, 0, 0],
      [0, 0, 0]
    ] as any;
    const helpers = createCpuPolicyDecisionContext({
      asRecord: (value: unknown) => (value && typeof value === 'object' ? value as Record<string, unknown> : {}),
      isFiniteNumber: (value: unknown) => Number.isFinite(Number(value)),
      countBoardDiscsForPlayer: () => ({ own: 7, opp: 5, empties: 4 }),
      countBoardEdgeDiscsForPlayer: () => ({ ownEdges: 3, oppEdges: 2 }),
      estimateOwnOppDiscs: () => ({ own: 8, opp: 4 })
    });

    const out = helpers.buildCardDecisionContext({
      board,
      playerValue: 1,
      level: 6,
      legalMovesCount: 3
    } as any);

    expect(out.totalCells).toBe(6);
    expect(out.discDiff).toBe(2);
    expect(out.empties).toBe(4);
    expect(out.ownDiscs).toBe(7);
    expect(out.oppDiscs).toBe(5);
    expect(out.ownEdges).toBe(3);
    expect(out.oppEdges).toBe(2);
    expect(out.forceUseCard).toBe(false);
  });

  test('lowers threshold under hand saturation and zeroes reserve floor when force-use is active', () => {
    const helpers = createCpuPolicyDecisionContext();

    const forced = helpers.buildCardDecisionContext({
      level: 6,
      playerValue: -1,
      legalMovesCount: 0,
      handSize: 5,
      ownCharge: 30,
      ownDiscs: 4,
      oppDiscs: 12,
      totalCells: 64
    } as any);

    expect(forced.forceUseCard).toBe(true);
    expect(forced.reserveChargeFloor).toBe(0);
    expect(forced.minUseScore).toBe(Number.NEGATIVE_INFINITY);
    expect(forced.whiteLv6Mode).toBe(true);
    expect(forced.lowDiscEmergency).toBe(true);
    expect(forced.criticalLowDiscEmergency).toBe(true);

    const pressured = helpers.buildCardDecisionContext({
      level: 6,
      playerValue: -1,
      legalMovesCount: 2,
      handSize: 4,
      ownCharge: 28,
      ownDiscs: 5,
      oppDiscs: 12,
      totalCells: 64,
      cornerEmergency: true
    } as any);

    expect(pressured.forceUseCard).toBe(false);
    expect(pressured.minUseScore).toBeLessThanOrEqual(6);
    expect(pressured.reserveChargeFloor).toBe(2);
  });
});
