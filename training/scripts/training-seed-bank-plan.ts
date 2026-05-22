'use strict';

import * as path from 'path';
import _seed_bank_manager from './seed-bank-manager';
const { buildSeedBank } = _seed_bank_manager;
import _training_command_args from './training-command-args';
const { stripLeadingScriptArg, collectCliFlagMap, getFlagValue, hasFlag } = _training_command_args;

function resolveMaybePath(cwd: any, value: any) {
    if (!value) return null;
    return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function getNumericFlagValue(flagMap: any, flag: any, fallback: any) {
    const raw = getFlagValue(flagMap, flag);
    if (raw === undefined || raw === true) return fallback;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function buildSeedBankGatesFromFlagMap(flagMap: any) {
    const baseSeed = getNumericFlagValue(flagMap, '--seed', 1);
    const quickSeedCount = getNumericFlagValue(
        flagMap,
        '--quick-adoption-seed-count',
        getNumericFlagValue(flagMap, '--adoption-seed-count', 1)
    );
    const quickSeedStride = getNumericFlagValue(
        flagMap,
        '--quick-adoption-seed-stride',
        getNumericFlagValue(flagMap, '--adoption-seed-stride', 1000)
    );
    const quickSeedOffset = getNumericFlagValue(flagMap, '--quick-adoption-seed-offset', 0);
    const finalSeedCount = getNumericFlagValue(
        flagMap,
        '--final-adoption-seed-count',
        getNumericFlagValue(flagMap, '--adoption-seed-count', 1)
    );
    const finalSeedStride = getNumericFlagValue(
        flagMap,
        '--final-adoption-seed-stride',
        getNumericFlagValue(flagMap, '--adoption-seed-stride', 1000)
    );
    const finalSeedOffset = getNumericFlagValue(
        flagMap,
        '--adoption-final-seed-offset',
        getNumericFlagValue(flagMap, '--eval-seed-offset', 500000)
    );

    const gates = {
        quick: {
            baseSeed: baseSeed + quickSeedOffset,
            seedCount: quickSeedCount,
            seedStride: quickSeedStride,
            purpose: 'quick adoption gate'
        },
        final: {
            baseSeed: baseSeed + finalSeedOffset,
            seedCount: finalSeedCount,
            seedStride: finalSeedStride,
            purpose: 'final adoption gate'
        },
        onnx: {
            baseSeed: baseSeed + getNumericFlagValue(flagMap, '--onnx-gate-seed-offset', 700000),
            seedCount: getNumericFlagValue(flagMap, '--onnx-gate-seed-count', 1),
            seedStride: getNumericFlagValue(flagMap, '--onnx-gate-seed-stride', 1000),
            purpose: hasFlag(flagMap, '--onnx-gate')
                ? 'onnx gate'
                : 'onnx gate schedule'
        }
    };
    if (hasFlag(flagMap, '--quality-gate')) {
        gates.quality = {
            baseSeed: baseSeed + getNumericFlagValue(flagMap, '--quality-gate-seed-offset', 250000),
            seedCount: getNumericFlagValue(flagMap, '--quality-gate-seed-count', 1),
            seedStride: getNumericFlagValue(flagMap, '--quality-gate-seed-stride', 1000),
            purpose: 'quality gate'
        };
    }
    return gates;
}

function buildSeedBankPlanFromArgs(trainCycleArgs: any, context: any) {
    const normalizedArgs = stripLeadingScriptArg(trainCycleArgs);
    const flagMap = collectCliFlagMap(normalizedArgs);
    const seedBankArg = getFlagValue(flagMap, '--seed-bank');
    if (seedBankArg === undefined || seedBankArg === true) return null;
    const seedBankPath = resolveMaybePath(
        context && context.cwd ? context.cwd : process.cwd(),
        String(seedBankArg || '').trim()
    );
    if (!seedBankPath) return null;

    return {
        path: seedBankPath,
        bankId: `${context && context.profileName ? context.profileName : 'training'}-seed-bank`,
        description: context && context.runTag
            ? `Auto-initialized seed bank for ${context.runTag}`
            : 'Auto-initialized seed bank',
        gates: buildSeedBankGatesFromFlagMap(flagMap)
    };
}

function buildSeedBankInitFromPlan(seedBankPlan: any) {
    if (!seedBankPlan || !seedBankPlan.path || !seedBankPlan.gates || typeof seedBankPlan.gates !== 'object') {
        return null;
    }
    return {
        seedBankPath: path.resolve(seedBankPlan.path),
        bank: buildSeedBank({
            bankId: seedBankPlan.bankId,
            description: seedBankPlan.description,
            gates: seedBankPlan.gates
        })
    };
}

function buildSeedBankInitFromResolved(resolved: any) {
    const seedBankInit = buildSeedBankInitFromPlan(
        resolved && resolved.seedBankPlan && typeof resolved.seedBankPlan === 'object'
            ? resolved.seedBankPlan
            : null
    );
    if (seedBankInit) return seedBankInit;

    const commandArgs = resolved && resolved.command && Array.isArray(resolved.command.args)
        ? resolved.command.args
        : [];
    const fallbackPlan = buildSeedBankPlanFromArgs(commandArgs, {
        cwd: resolved && resolved.cwd ? resolved.cwd : process.cwd(),
        profileName: resolved && resolved.profile ? resolved.profile.name : 'training',
        runTag: resolved && resolved.paths ? resolved.paths.runTag : null
    });
    return buildSeedBankInitFromPlan(fallbackPlan);
}

export = {
    buildSeedBankGatesFromFlagMap,
    buildSeedBankPlanFromArgs,
    buildSeedBankInitFromPlan,
    buildSeedBankInitFromResolved
};
