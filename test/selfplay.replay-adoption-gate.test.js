'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    buildSeedBank,
    writeSeedBank
} = require('../scripts/seed-bank-manager');
const {
    inferReplayGateType,
    buildReplayOptions,
    replayGate
} = require('../scripts/replay-adoption-gate');

describe('selfplay replay adoption gate', () => {
    test('inferReplayGateType falls back to payload path name', () => {
        expect(inferReplayGateType({}, null, 'C:\\tmp\\adoption.quick.demo.json')).toBe('quick');
        expect(inferReplayGateType({}, null, 'C:\\tmp\\adoption.final.demo.json')).toBe('final');
        expect(inferReplayGateType({}, null, 'C:\\tmp\\adoption.quality.demo.json')).toBe('quality');
    });

    test('buildReplayOptions reuses payload seed schedule by default', () => {
        const resolved = buildReplayOptions({
            gateType: 'quick',
            config: {
                games: 50,
                seed: 100,
                seedCount: 3,
                seedStride: 500,
                candidateModelPath: 'C:\\models\\candidate.json'
            },
            seedSchedule: {
                baseSeed: 900,
                seedCount: 2,
                seedStride: 100,
                scheduledSeeds: [900, 1000],
                completedSeeds: [900, 1000]
            }
        }, {
            gatePayloadPath: 'C:\\tmp\\adoption.quick.demo.json',
            gateType: null,
            seedBankPath: null,
            candidateModelPath: null,
            baselineModelPath: null,
            opponentModelPath: null,
            verbose: false
        });

        expect(resolved.gateType).toBe('quick');
        expect(resolved.seedSchedule).toMatchObject({
            baseSeed: 900,
            seedCount: 2,
            seedStride: 100
        });
        expect(resolved.options.seed).toBe(900);
        expect(resolved.options.seedCount).toBe(2);
    });

    test('buildReplayOptions can override seeds from seed bank', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-seed-bank-'));
        const seedBankPath = path.join(tempDir, 'seed-bank.json');

        try {
            writeSeedBank(seedBankPath, buildSeedBank({
                gates: {
                    final: {
                        baseSeed: 500000,
                        seedCount: 5,
                        seedStride: 1000
                    }
                }
            }));

            const resolved = buildReplayOptions({
                gateType: 'final',
                config: {
                    games: 200,
                    seed: 10,
                    seedCount: 1,
                    seedStride: 1,
                    candidateModelPath: 'C:\\models\\candidate.json'
                }
            }, {
                gatePayloadPath: 'C:\\tmp\\adoption.final.demo.json',
                seedBankPath,
                candidateModelPath: null,
                baselineModelPath: null,
                opponentModelPath: null,
                verbose: false
            });

            expect(resolved.options.seed).toBe(500000);
            expect(resolved.options.seedCount).toBe(5);
            expect(resolved.seedSchedule.scheduledSeeds).toEqual([500000, 501000, 502000, 503000, 504000]);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('replayGate dispatches to quality runner and records replay metadata', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-quality-'));
        const gatePayloadPath = path.join(tempDir, 'adoption.quality.demo.json');
        fs.writeFileSync(gatePayloadPath, JSON.stringify({
            generatedAt: '2026-04-02T00:00:00.000Z',
            gateType: 'quality',
            config: {
                games: 20,
                seed: 11,
                seedCount: 2,
                seedStride: 8,
                candidateModelPath: path.join(tempDir, 'candidate.json'),
                qualityWeights: {
                    qualityWeightCorner: 0.2
                }
            }
        }, null, 2), 'utf8');

        try {
            const result = await replayGate({
                gatePayloadPath,
                gateType: null,
                seedBankPath: null,
                candidateModelPath: null,
                baselineModelPath: null,
                opponentModelPath: null,
                out: null,
                verbose: false
            }, {
                runAdoptionCheck: async () => {
                    throw new Error('adoption runner should not be used for quality gate replay');
                },
                runQualityGate: async (options) => ({
                    gateType: 'quality',
                    config: {
                        seed: options.seed,
                        seedCount: options.seedCount
                    },
                    decision: {
                        passed: true,
                        primaryFailureReason: null
                    }
                })
            });

            expect(result.replay).toMatchObject({
                sourceGatePayloadPath: gatePayloadPath,
                sourceGateType: 'quality',
                sourceGeneratedAt: '2026-04-02T00:00:00.000Z'
            });
            expect(result.replay.seedSchedule).toMatchObject({
                baseSeed: 11,
                seedCount: 2,
                seedStride: 8
            });
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
