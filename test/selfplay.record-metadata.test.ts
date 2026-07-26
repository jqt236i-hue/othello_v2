const { createSelfplayRecordMetadata } = require('../src/engine/selfplay-record-metadata.js');

describe('selfplay record metadata module', () => {
    const metadata = createSelfplayRecordMetadata({
        isCorner: (row, col) => (row === 0 || row === 7) && (col === 0 || col === 7),
        isEdge: (row, col) => row === 0 || row === 7 || col === 0 || col === 7,
        countEmptiesInBoardKey: (boardKey) => String(boardKey || '').split('').filter((ch) => ch === '.').length
    });

    test('buildPendingSelectionRecord and trace classify board-cell selections', () => {
        const pendingSelection = metadata.buildPendingSelectionRecord({
            type: 'place',
            teleportTarget: { row: 0, col: 7 }
        }, 'TELEPORT_WILL');
        const trace = metadata.buildPendingSelectionTrace({ pendingSelection });

        expect(pendingSelection).toEqual({
            kind: 'board_cell',
            pendingType: 'TELEPORT_WILL',
            sourceKey: 'teleportTarget',
            row: 0,
            col: 7
        });
        expect(trace).toEqual({
            kind: 'board_cell',
            pendingType: 'TELEPORT_WILL',
            sourceKey: 'teleportTarget',
            row: 0,
            col: 7,
            seat: 'corner'
        });
    });

    test('expansion target records preserve direction identity and additions', () => {
        const pendingSelection = metadata.buildPendingSelectionRecord({
            type: 'place',
            expansionTarget: {
                row: 0,
                col: 0,
                directionKey: 'up-left',
                side: 'top',
                additions: [
                    { row: -1, col: -1 },
                    { row: -1, col: 0 }
                ]
            }
        }, 'BOARD_EXPANSION_GOD');
        const trace = metadata.buildPendingSelectionTrace({ pendingSelection });

        expect(pendingSelection).toEqual(expect.objectContaining({
            row: 0,
            col: 0,
            directionKey: 'up-left',
            side: 'top',
            additions: [
                { row: -1, col: -1 },
                { row: -1, col: 0 }
            ]
        }));
        expect(trace).toEqual(expect.objectContaining({
            directionKey: 'up-left',
            side: 'top',
            additions: [
                { row: -1, col: -1 },
                { row: -1, col: 0 }
            ]
        }));
    });

    test('buildSelectionTrace preserves card candidate summaries and selected placement seat', () => {
        const cardTrace = metadata.buildSelectionTrace({
            actionType: 'use_card',
            useCardId: 'guard_01',
            selectedActionKey: 'use:guard_01',
            usableCardIds: ['guard_01'],
            handCards: ['guard_01'],
            decisionReasonTags: ['corner_hold'],
            decisionCandidates: [
                {
                    actionType: 'use_card',
                    decisionKind: 'use',
                    cardId: 'guard_01',
                    isSelected: true,
                    finalScore: 123
                }
            ]
        });
        const placeTrace = metadata.buildSelectionTrace({
            actionType: 'place',
            row: 0,
            col: 3,
            selectedCompositeScore: 55,
            topPlacementCandidates: [
                { row: 0, col: 3, seat: 'edge', combinedScore: 55 }
            ]
        });

        expect(cardTrace).toEqual(expect.objectContaining({
            kind: 'card',
            decision: 'use',
            selectedCardId: 'guard_01',
            candidates: [expect.objectContaining({ cardId: 'guard_01', finalScore: 123, isSelected: true })]
        }));
        expect(placeTrace).toEqual({
            kind: 'place',
            selected: {
                row: 0,
                col: 3,
                seat: 'edge',
                selectedCompositeScore: 55,
                selectedTacticalScore: null,
                selectedCommitteeScore: null,
                selectedCommitteeVotes: 0,
                selectedCellBonus: null
            },
            topCandidates: [
                {
                    row: 0,
                    col: 3,
                    seat: 'edge',
                    combinedScore: 55,
                    tacticalScore: null,
                    heuristicScore: null,
                    policyScore: null,
                    committeeScore: null,
                    finalScore: null,
                    committeeVotes: 0
                }
            ],
            forcedPlacementCategory: null,
            pendingSelection: null
        });
    });

    test('annotateHorizonDecisionMetrics and v2 metadata attach future metrics and hardcase view', () => {
        const records = [
            {
                player: 'black',
                board: 'BBBB/WWWW/..../..../..../..../..../....',
                legalMoves: 2,
                handCards: ['a', 'b', 'c', 'd'],
                pendingType: 'CHAIN_WILL',
                blackCountBefore: 10,
                blackCountAfter: 12,
                whiteCountBefore: 8,
                whiteCountAfter: 6,
                ownCornersBefore: 0,
                ownCornersAfter: 1,
                oppCornersBefore: 0,
                oppCornersAfter: 0,
                ownEdgesBefore: 1,
                ownEdgesAfter: 4,
                oppEdgesBefore: 2,
                oppEdgesAfter: 1,
                hasCornerMoveNow: true,
                cornerEmergency: true,
                tacticalScoreMissRatio: 0.1,
                topPlacementCandidates: [],
                actionType: 'place',
                row: 3,
                col: 3
            },
            {
                player: 'white',
                board: 'BBBB/WWWW/..../..../..../..../..../....',
                blackCountBefore: 12,
                blackCountAfter: 11,
                whiteCountBefore: 6,
                whiteCountAfter: 7,
                ownCornersBefore: 0,
                ownCornersAfter: 1,
                oppCornersBefore: 1,
                oppCornersAfter: 1,
                ownEdgesBefore: 1,
                ownEdgesAfter: 2,
                oppEdgesBefore: 4,
                oppEdgesAfter: 4
            }
        ];

        metadata.annotateHorizonDecisionMetrics(records, 1);
        metadata.annotateSelfplayV2Metadata(records, { seedFamily: 'eval', dataLane: 'audit' });

        expect(records[0]).toEqual(expect.objectContaining({
            futureDiscDelta3Ply: -1,
            ownCornersAfter3Ply: 1,
            cornerHoldTurnsNext3Plies: 1,
            horizonPliesUsed: 1,
            visibilityScope: 'actor',
            seedFamily: 'eval',
            dataLane: 'audit',
            isHardcase: true,
            hardcasePrimaryTag: 'corner_move_available',
            actorView: expect.objectContaining({
                player: 'black',
                cornerEmergency: 1,
                pendingType: 'CHAIN_WILL',
                selectionTrace: expect.objectContaining({ kind: 'place' })
            })
        }));
        expect(records[0].hardcaseTags).toEqual(expect.arrayContaining([
            'corner_move_available',
            'corner_emergency',
            'low_legal_moves',
            'hand_pressure',
            'pending_target_selection',
            'tactical_miss_high',
            'edge_balance_swing',
            'endgame_mode'
        ]));
    });
});
