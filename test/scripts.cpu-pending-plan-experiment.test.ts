const PendingExperiment = require('../scripts/cpu-pending-plan-experiment');
const pendingVm = require('vm');

describe('card-aware placement experiment', () => {
    test('rejects a missing or duplicate browser hook', () => {
        const needle = 'const resolved = deps.resolveCandidateMoveByCoord(prioritizedCandidateMoves, selected) || selected;';
        expect(() => PendingExperiment.patchPendingPlanRegistry('')).toThrow();
        expect(() => PendingExperiment.patchPendingPlanRegistry(needle + needle)).toThrow();
        expect(PendingExperiment.patchPendingPlanRegistry(needle)).toContain('__pendingPlanExperiment');
    });
    test('preserves ordinary placement, opponent and low levels; applies only legal pending corrections', () => {
        const root: any = {};
        pendingVm.runInNewContext(`(${PendingExperiment.installPendingPlanExperiment.toString()})({color:'black'})`,
            { window: root, performance: { now: () => 0 } });
        const moves = [{ row: 2, col: 3 }, { row: 0, col: 0 }];
        const refine = jest.fn(() => moves[1]);
        const deps = { resolveCandidateMoveByCoord: (list: any[], move: any) => list.find(m => m.row === move?.row && m.col === move?.col), refineOnnxMoveByTacticalPlan: refine };
        const choose = (player: string, level: number, pending: any) => root.__pendingPlanExperiment(deps, moves, moves[0], player, level, pending);
        expect(choose('black', 6, null)).toBe(moves[0]);
        expect(choose('white', 9, 'WORK_WILL')).toBe(moves[0]);
        expect(choose('black', 5, 'WORK_WILL')).toBe(moves[0]);
        expect(refine).not.toHaveBeenCalled();
        for (const level of [6, 7, 8, 9]) expect(choose('black', level, 'WORK_WILL')).toBe(moves[1]);
        refine.mockReturnValue({ row: 99, col: 99 });
        expect(() => choose('black', 6, 'WORK_WILL')).toThrow('illegal');
    });
});
