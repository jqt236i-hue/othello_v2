'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const { SEED_BANK_SCHEMA_VERSION, buildSeedBank, loadSeedBank, writeSeedBank, commitSeedBankUsage, resolveSeedScheduleFromBank } = require('../scripts/seed-bank-manager');
describe('selfplay seed bank manager', () => {
    test('buildSeedBank normalizes gate schedules', () => {
        const bank = buildSeedBank({
            bankId: 'ladder-seeds-v1',
            description: 'Replay-ready seed schedule',
            gates: {
                quick: {
                    baseSeed: 1000,
                    seedCount: 3.9,
                    seedStride: 500.4
                },
                final: {
                    baseSeed: 9000,
                    seedCount: 2,
                    seedStride: 250
                }
            }
        });
        expect(bank.schemaVersion).toBe(SEED_BANK_SCHEMA_VERSION);
        expect(bank.bankId).toBe('ladder-seeds-v1');
        expect(bank.gates.quick).toMatchObject({
            gateType: 'quick',
            baseSeed: 1000,
            seedCount: 3,
            seedStride: 500,
            scheduledSeeds: [1000, 1500, 2000]
        });
        expect(bank.gates.final.scheduledSeeds).toEqual([9000, 9250]);
    });
    test('write/load/commit round-trips usage and gate schedules', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-bank-'));
        const bankPath = path.join(tempDir, 'seed-bank.json');
        try {
            writeSeedBank(bankPath, buildSeedBank({
                bankId: 'seed-bank-test',
                gates: {
                    quality: {
                        baseSeed: 250000,
                        seedCount: 4,
                        seedStride: 1000
                    }
                }
            }));
            const loaded = loadSeedBank(bankPath);
            expect(loaded.gates.quality.scheduledSeeds).toEqual([250000, 251000, 252000, 253000]);
            const updated = commitSeedBankUsage(bankPath, {
                gateType: 'quality',
                runTag: 'browser_lv6_deploy_v1_20260402_000000',
                iteration: 3,
                promotionId: 'promotion-3',
                gatePayloadPath: 'C:\\tmp\\adoption.quality.demo.json'
            });
            expect(updated.usage).toHaveLength(1);
            expect(updated.usage[0]).toMatchObject({
                gateType: 'quality',
                iteration: 3,
                promotionId: 'promotion-3'
            });
            const resolved = resolveSeedScheduleFromBank(bankPath, 'quality');
            expect(resolved).toMatchObject({
                gateType: 'quality',
                baseSeed: 250000,
                seedCount: 4,
                seedStride: 1000
            });
        }
        finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=selfplay.seed-bank-manager.test.js.map