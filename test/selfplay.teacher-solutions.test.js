const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    TEACHER_SOLUTION_SCHEMA_VERSION,
    buildDefaultTeacherSolutionOutPath,
    inferTeacherDecisionKind,
    toTeacherSolutionRecord,
    parseArgs,
    exportTeacherSolutions
} = require('../scripts/export-teacher-solutions');

describe('teacher solution export script', () => {
    test('parseArgs infers default teacher solution output path', () => {
        const args = parseArgs(['--input', 'data/runs/hardcase_mining_v1/selfplay.train.hardcase.sample.ndjson']);
        expect(args.out).toBe(path.resolve(process.cwd(), 'data/runs/hardcase_mining_v1/teacher_solution.sample.ndjson'));
    });

    test('toTeacherSolutionRecord keeps training-compatible fields and adds teacher metadata', () => {
        const record = {
            schemaVersion: 'selfplay.v2',
            gameIndex: 3,
            ply: 11,
            player: 'black',
            actionType: 'destroy_hand_card',
            board: '......../......../......../...WB.../...BW.../......../......../........',
            legalMoves: 4,
            pendingType: 'CONDEMN_WILL',
            destroyCardId: 'last_resort_01',
            handCards: ['last_resort_01', 'guard_01'],
            usableCardIds: ['guard_01'],
            hardcaseTags: ['pending_target', 'legal_moves_le_2'],
            hardcasePrimaryTag: 'pending_target',
            actorView: { board: 'x', selectionTrace: { kind: 'place' } },
            topPlacementCandidates: [
                { row: 2, col: 5, seat: 'edge', combinedScore: 9, finalScore: 10, committeeVotes: 3 },
                { row: 1, col: 4, seat: 'inner', combinedScore: 7, finalScore: 7.5, committeeVotes: 1 }
            ]
        };

        const out = toTeacherSolutionRecord(record, { inputPath: 'sample.ndjson', lineNumber: 8 });

        expect(out.schemaVersion).toBe(TEACHER_SOLUTION_SCHEMA_VERSION);
        expect(out.sourceSchemaVersion).toBe('selfplay.v2');
        expect(out.actionType).toBe('destroy_hand_card');
        expect(out.destroyCardId).toBe('last_resort_01');
        expect(out.teacherSolution.decisionKind).toBe('destroy');
        expect(out.teacherSolution.selectedActionKey).toBe('destroy:last_resort_01');
        expect(out.teacherSolution.actorView).toEqual(record.actorView);
        expect(out.teacherSolution.candidates).toEqual(expect.arrayContaining([
            expect.objectContaining({ cardId: 'last_resort_01', isSelected: true }),
            expect.objectContaining({ cardId: 'guard_01', isSelected: false })
        ]));
    });

    test('exportTeacherSolutions writes only hardcase records by default', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-solution-'));
        const inputPath = path.join(tempDir, 'selfplay.train.hardcase.demo.ndjson');
        const outputPath = buildDefaultTeacherSolutionOutPath(inputPath);
        const lines = [
            JSON.stringify({
                schemaVersion: 'selfplay.v2',
                actionType: 'cancel_card',
                player: 'white',
                board: '......../......../......../...WB.../...BW.../......../......../........',
                legalMoves: 0,
                usableCardIds: ['silver_01'],
                hardcaseTags: ['legal_moves_le_2']
            }),
            JSON.stringify({
                schemaVersion: 'selfplay.v2',
                actionType: 'place',
                player: 'black',
                board: '......../......../......../...WB.../...BW.../......../......../........',
                legalMoves: 4,
                row: 2,
                col: 3,
                hardcaseTags: []
            })
        ];
        fs.writeFileSync(inputPath, `${lines.join('\n')}\n`, 'utf8');

        const summary = await exportTeacherSolutions({
            input: inputPath,
            out: outputPath,
            includeNonHardcase: false,
            limit: 0
        });

        const written = fs.readFileSync(outputPath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((one) => JSON.parse(one));
        expect(summary.recordsRead).toBe(2);
        expect(summary.recordsWritten).toBe(1);
        expect(summary.skippedNonHardcase).toBe(1);
        expect(summary.byDecisionKind.keep).toBe(1);
        expect(written).toHaveLength(1);
        expect(inferTeacherDecisionKind(written[0])).toBe('keep');
        expect(written[0].teacherSolution.candidates[0]).toEqual(expect.objectContaining({
            cardId: '__no_card__',
            isSelected: true
        }));
    });

    test('toTeacherSolutionRecord prefers live trace candidates and selectedActionKey when present', () => {
        const record = {
            schemaVersion: 'selfplay.v2',
            actionType: 'use_card',
            player: 'white',
            useCardId: 'guard_01',
            usableCardIds: ['guard_01', 'time_01'],
            actorView: {
                board: 'x',
                selectionTrace: {
                    kind: 'card',
                    decision: 'use',
                    selectedActionKey: 'use:guard_01',
                    candidates: [
                        {
                            actionType: 'use_card',
                            decisionKind: 'use',
                            cardId: 'guard_01',
                            cardType: 'GUARD_WILL',
                            cardCost: 2,
                            score: 48,
                            shouldUse: true,
                            minUseScore: 12,
                            isSelected: true
                        },
                        {
                            actionType: 'use_card',
                            decisionKind: 'use',
                            cardId: 'time_01',
                            cardType: 'TIME_BOMB',
                            cardCost: 10,
                            score: 8,
                            shouldUse: false,
                            minUseScore: 12,
                            isSelected: false
                        }
                    ]
                }
            },
            selectedActionKey: 'use:guard_01',
            hardcaseTags: ['hand_pressure']
        };

        const out = toTeacherSolutionRecord(record, { inputPath: 'sample.ndjson', lineNumber: 3 });

        expect(out.teacherSolution.selectedActionKey).toBe('use:guard_01');
        expect(out.teacherSolution.candidates).toEqual([
            expect.objectContaining({ cardId: 'guard_01', isSelected: true, cardType: 'GUARD_WILL' }),
            expect.objectContaining({ cardId: 'time_01', isSelected: false, cardType: 'TIME_BOMB' })
        ]);
    });
});
