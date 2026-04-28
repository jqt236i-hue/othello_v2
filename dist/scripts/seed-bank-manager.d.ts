#!/usr/bin/env node
declare function buildSeedBank(options: any): {
    schemaVersion: string;
    generatedAt: string;
    bankId: string;
    description: string | null;
    gates: {};
    usage: any;
};
declare function validateSeedBank(bank: any): {
    schemaVersion: string;
    generatedAt: string;
    bankId: string;
    description: string | null;
    gates: {};
    usage: any;
};
declare function loadSeedBank(filePath: string): {
    schemaVersion: string;
    generatedAt: string;
    bankId: string;
    description: string | null;
    gates: {};
    usage: any;
};
declare function writeSeedBank(filePath: any, bank: any): string;
declare function commitSeedBankUsage(filePath: any, usage: any): {
    schemaVersion: string;
    generatedAt: string;
    bankId: string;
    description: string | null;
    gates: {};
    usage: any;
};
declare function syncSeedBank(filePath: any, desiredBank: any): {
    path: string;
    created: boolean;
    updated: boolean;
    bank: {
        schemaVersion: string;
        generatedAt: string;
        bankId: string;
        description: string | null;
        gates: {};
        usage: any;
    };
};
declare function resolveSeedScheduleFromBank(bankOrPath: any, gateType: any): {
    gateType: string;
    baseSeed: any;
    seedCount: any;
    seedStride: any;
    scheduledSeeds: any;
    completedSeeds: any;
    purpose: any;
};
declare const _default: {
    SEED_BANK_SCHEMA_VERSION: string;
    SUPPORTED_GATE_TYPES: readonly string[];
    buildSeedBank: typeof buildSeedBank;
    validateSeedBank: typeof validateSeedBank;
    loadSeedBank: typeof loadSeedBank;
    writeSeedBank: typeof writeSeedBank;
    commitSeedBankUsage: typeof commitSeedBankUsage;
    syncSeedBank: typeof syncSeedBank;
    resolveSeedScheduleFromBank: typeof resolveSeedScheduleFromBank;
};
export = _default;
//# sourceMappingURL=seed-bank-manager.d.ts.map