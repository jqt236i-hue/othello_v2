import { createCpuDecisionBoardUtils } from '../game/cpu-decision-board-utils';
import * as fs from 'fs';
import * as path from 'path';

function createSharedBoardUtils() {
    return {
        isStandardBoard8x8: jest.fn(() => true),
        isCornerCell: jest.fn(() => false),
        isEdgeCell: jest.fn(() => true)
    };
}

describe('cpu decision board utils composition boundary', () => {
    test('requires shared geometry while preserving the historical raw CPU counters', () => {
        const sharedBoardUtils = createSharedBoardUtils();
        const boardUtils = createCpuDecisionBoardUtils({ sharedBoardUtils });
        const board = [
            [1, 0, -1],
            [0, 1],
            [-1, 0, 1]
        ];

        expect(boardUtils.countBoardEmpties(board)).toBe(3);
        expect(boardUtils.isStandardBoard8x8(board)).toBe(true);
        expect(boardUtils.isCornerCell(0, 0, board)).toBe(false);
        expect(boardUtils.isEdgeCell(0, 0, board)).toBe(true);
        expect(boardUtils.countCornerControl(board, 1)).toEqual({ ownCorners: 2, oppCorners: 2 });
        expect(boardUtils.countEdgeControl(board, 1)).toEqual({ ownEdges: 3, oppEdges: 2 });

        expect(sharedBoardUtils.isStandardBoard8x8).toHaveBeenCalledWith(board);
        expect(sharedBoardUtils.isCornerCell).toHaveBeenCalledWith(0, 0, board);
        expect(sharedBoardUtils.isEdgeCell).toHaveBeenCalledWith(0, 0, board);
    });

    test('keeps CPU-local card-state and card-definition normalization deterministic', () => {
        const boardUtils = createCpuDecisionBoardUtils({ sharedBoardUtils: createSharedBoardUtils() });
        const cardState = {
            boardBonusByCell: { '2,3': 4, '4,5': -1 },
            boardBonusConsumedByCell: { '1,1': true, '2,3': false }
        };

        expect(boardUtils.getBoardBonusValueAt(2, 3, cardState)).toBe(4);
        expect(boardUtils.getBoardBonusValueAt(1, 1, cardState)).toBe(0);
        expect(boardUtils.getBoardBonusValueAt(4, 5, cardState)).toBe(0);
        expect(boardUtils.getBoardBonusValueAt(1.5, 1, cardState)).toBe(0);
        expect(boardUtils.resolveCardType('fallback', { type: 'DIRECT' }, null)).toBe('DIRECT');
        expect(boardUtils.resolveCardType('fallback', null, {
            getCardDef: (cardId: string) => ({ type: `${cardId}_TYPE` })
        })).toBe('fallback_TYPE');
        expect(boardUtils.resolveCardType('fallback', null, {
            getCardDef: () => { throw new Error('lookup failure'); }
        })).toBe('');
    });

    test('fails during composition when a required shared board capability is absent', () => {
        expect(() => createCpuDecisionBoardUtils({
            sharedBoardUtils: { isStandardBoard8x8: () => true } as any
        })).toThrow('CpuDecisionBoardUtils requires SharedBoardUtils.isCornerCell');
    });

    test('keeps the replaced fallback bodies out of the CPU facade', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'cpu-decision.ts'), 'utf8');

        expect(source).toContain('createCpuDecisionBoardUtils({ sharedBoardUtils: CpuDecisionSharedBoardUtils })');
        expect(source).toContain('const CpuPolicyBoardMarkerPrimitivesRequired = requireCpuPolicyBoardMarkerPrimitives();');
        expect(source).toContain('CpuPolicyBoardMarkerPrimitivesRequired.getBoardCellValueSafe(');
        expect(source).toContain('CpuPolicyBoardMarkerPrimitivesRequired.getMarkerProfileAt(');
        expect(source).toContain('const CpuPolicyPlacementFiltersRequired = requireCpuPolicyPlacementFilters();');
        expect(source).toContain('CpuPolicyPlacementFiltersRequired.filterLv6OpenCornerAdjacentMoves(');
        expect(source).toContain('CpuPolicyPlacementFiltersRequired.filterCloneSplitTargetsForLv6(');
        expect(source).toContain('const CpuPolicyPendingTargetsRequired = requireCpuPolicyPendingTargets();');
        expect(source).toContain('CpuPolicyPendingTargetsRequired.getCornerProximity(');
        expect(source).toContain('CpuPolicyPendingTargetsRequired.choosePendingTargetWithPolicyAsync(');
        expect(source).not.toMatch(/countBoardEmptiesFallback|isStandardBoard8x8Fallback|isCornerCellFallback|isEdgeCellFallback/);
        expect(source).not.toMatch(/countCornerControlFallback|countEdgeControlFallback/);
        expect(source).not.toContain('function getMarkerPriorityValueFallback');
    });
});
