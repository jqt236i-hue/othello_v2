#!/usr/bin/env node
// @ts-nocheck
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const policy_seed_utils_1 = __importDefault(require("./policy-seed-utils"));
const { buildSeedSchedule, sanitizeSeedList } = policy_seed_utils_1.default;
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const SEED_BANK_SCHEMA_VERSION = 'seed_bank.v1';
const SUPPORTED_GATE_TYPES = Object.freeze(['quick', 'quality', 'final', 'onnx']);
function normalizeGateType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return SUPPORTED_GATE_TYPES.includes(normalized) ? normalized : null;
}
function normalizeOptionalString(value) {
    return typeof value === 'string' && value.trim()
        ? value.trim()
        : null;
}
function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function writeJson(filePath, payload) {
    const resolvedPath = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, JSON.stringify(payload, null, 2), 'utf8');
    return resolvedPath;
}
function buildSeedBankGate(config, gateType) {
    if (!config || typeof config !== 'object')
        return null;
    const schedule = buildSeedSchedule(config.baseSeed, config.seedCount, config.seedStride, config.completedSeeds);
    return {
        gateType,
        baseSeed: schedule.baseSeed,
        seedCount: schedule.seedCount,
        seedStride: schedule.seedStride,
        scheduledSeeds: Array.isArray(config.scheduledSeeds) && config.scheduledSeeds.length > 0
            ? sanitizeSeedList(config.scheduledSeeds)
            : schedule.scheduledSeeds,
        completedSeeds: schedule.completedSeeds,
        purpose: normalizeOptionalString(config.purpose)
    };
}
function sanitizeSeedBankUsage(usage) {
    if (!usage || typeof usage !== 'object') {
        throw new Error('seed bank usage must be an object');
    }
    const gateType = normalizeGateType(usage.gateType);
    if (!gateType) {
        throw new Error(`unsupported seed bank gate type: ${usage.gateType}`);
    }
    const iteration = Number.isFinite(Number(usage.iteration))
        ? Number(usage.iteration)
        : null;
    return {
        recordedAt: normalizeOptionalString(usage.recordedAt) || new Date().toISOString(),
        gateType,
        runTag: normalizeOptionalString(usage.runTag),
        iteration,
        promotionId: normalizeOptionalString(usage.promotionId),
        gatePayloadPath: normalizeOptionalString(usage.gatePayloadPath),
        note: normalizeOptionalString(usage.note)
    };
}
function buildSeedBank(options) {
    const gatesInput = options && typeof options.gates === 'object'
        ? options.gates
        : {};
    const gates = {};
    for (const gateType of SUPPORTED_GATE_TYPES) {
        const gate = buildSeedBankGate(gatesInput[gateType], gateType);
        if (gate)
            gates[gateType] = gate;
    }
    return {
        schemaVersion: SEED_BANK_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        bankId: normalizeOptionalString(options && options.bankId) || `seed-bank-${Date.now()}`,
        description: normalizeOptionalString(options && options.description),
        gates,
        usage: Array.isArray(options && options.usage)
            ? options.usage.map((one) => sanitizeSeedBankUsage(one))
            : []
    };
}
function validateSeedBank(bank) {
    if (!bank || typeof bank !== 'object') {
        throw new Error('seed bank must be an object');
    }
    if (bank.schemaVersion !== SEED_BANK_SCHEMA_VERSION) {
        throw new Error(`seed bank schema must be ${SEED_BANK_SCHEMA_VERSION}`);
    }
    const gates = {};
    const gatesInput = bank.gates && typeof bank.gates === 'object'
        ? bank.gates
        : {};
    for (const [rawGateType, config] of Object.entries(gatesInput)) {
        const gateType = normalizeGateType(rawGateType);
        if (!gateType) {
            throw new Error(`unsupported seed bank gate type: ${rawGateType}`);
        }
        const gate = buildSeedBankGate(config, gateType);
        if (!gate) {
            throw new Error(`missing seed bank gate config for ${gateType}`);
        }
        gates[gateType] = gate;
    }
    return {
        schemaVersion: SEED_BANK_SCHEMA_VERSION,
        generatedAt: normalizeOptionalString(bank.generatedAt) || new Date().toISOString(),
        bankId: normalizeOptionalString(bank.bankId) || `seed-bank-${Date.now()}`,
        description: normalizeOptionalString(bank.description),
        gates,
        usage: Array.isArray(bank.usage)
            ? bank.usage.map((one) => sanitizeSeedBankUsage(one))
            : []
    };
}
function loadSeedBank(filePath) {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`seed bank not found: ${resolvedPath}`);
    }
    return validateSeedBank(readJson(resolvedPath));
}
function writeSeedBank(filePath, bank) {
    const validated = validateSeedBank(bank);
    return writeJson(filePath, validated);
}
function commitSeedBankUsage(filePath, usage) {
    const resolvedPath = path.resolve(filePath);
    const bank = loadSeedBank(resolvedPath);
    bank.usage.push(sanitizeSeedBankUsage(usage));
    writeSeedBank(resolvedPath, bank);
    return bank;
}
function arraysEqual(a, b) {
    const left = Array.isArray(a) ? a : [];
    const right = Array.isArray(b) ? b : [];
    if (left.length !== right.length)
        return false;
    for (let i = 0; i < left.length; i++) {
        if (Number(left[i]) !== Number(right[i]))
            return false;
    }
    return true;
}
function syncSeedBank(filePath, desiredBank) {
    const resolvedPath = path.resolve(filePath);
    const desired = validateSeedBank(desiredBank);
    if (!fs.existsSync(resolvedPath)) {
        writeSeedBank(resolvedPath, desired);
        return {
            path: resolvedPath,
            created: true,
            updated: false,
            bank: desired
        };
    }
    const existing = loadSeedBank(resolvedPath);
    let changed = false;
    const next = {
        schemaVersion: SEED_BANK_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        bankId: existing.bankId || desired.bankId,
        description: desired.description || existing.description || null,
        gates: Object.assign({}, existing.gates),
        usage: Array.isArray(existing.usage) ? existing.usage.slice() : []
    };
    for (const gateType of Object.keys(desired.gates || {})) {
        const desiredGate = desired.gates[gateType];
        const existingGate = existing.gates && existing.gates[gateType]
            ? existing.gates[gateType]
            : null;
        const desiredScheduledSeeds = Array.isArray(desiredGate && desiredGate.scheduledSeeds)
            ? desiredGate.scheduledSeeds.slice()
            : [];
        const existingCompletedSeeds = Array.isArray(existingGate && existingGate.completedSeeds)
            ? existingGate.completedSeeds.filter((seed) => desiredScheduledSeeds.includes(seed))
            : [];
        const nextGate = Object.assign({}, desiredGate, {
            completedSeeds: existingCompletedSeeds
        });
        next.gates[gateType] = nextGate;
        const gateChanged = !existingGate ||
            Number(existingGate.baseSeed) !== Number(nextGate.baseSeed) ||
            Number(existingGate.seedCount) !== Number(nextGate.seedCount) ||
            Number(existingGate.seedStride) !== Number(nextGate.seedStride) ||
            !arraysEqual(existingGate.scheduledSeeds, nextGate.scheduledSeeds) ||
            !arraysEqual(existingGate.completedSeeds, nextGate.completedSeeds) ||
            String(existingGate.purpose || '') !== String(nextGate.purpose || '');
        if (gateChanged)
            changed = true;
    }
    if (String(existing.description || '') !== String(next.description || '')) {
        changed = true;
    }
    if (!changed) {
        return {
            path: resolvedPath,
            created: false,
            updated: false,
            bank: existing
        };
    }
    writeSeedBank(resolvedPath, next);
    return {
        path: resolvedPath,
        created: false,
        updated: true,
        bank: next
    };
}
function resolveSeedScheduleFromBank(bankOrPath, gateType) {
    const normalizedGateType = normalizeGateType(gateType);
    if (!normalizedGateType) {
        throw new Error(`unsupported seed bank gate type: ${gateType}`);
    }
    const bank = typeof bankOrPath === 'string'
        ? loadSeedBank(bankOrPath)
        : validateSeedBank(bankOrPath);
    const schedule = bank.gates[normalizedGateType];
    if (!schedule) {
        throw new Error(`seed bank does not include gate: ${normalizedGateType}`);
    }
    return {
        gateType: normalizedGateType,
        baseSeed: schedule.baseSeed,
        seedCount: schedule.seedCount,
        seedStride: schedule.seedStride,
        scheduledSeeds: Array.isArray(schedule.scheduledSeeds) ? schedule.scheduledSeeds.slice() : [],
        completedSeeds: Array.isArray(schedule.completedSeeds) ? schedule.completedSeeds.slice() : [],
        purpose: schedule.purpose || null
    };
}
module.exports = {
    SEED_BANK_SCHEMA_VERSION,
    SUPPORTED_GATE_TYPES,
    buildSeedBank,
    validateSeedBank,
    loadSeedBank,
    writeSeedBank,
    commitSeedBankUsage,
    syncSeedBank,
    resolveSeedScheduleFromBank
};
//# sourceMappingURL=seed-bank-manager.js.map