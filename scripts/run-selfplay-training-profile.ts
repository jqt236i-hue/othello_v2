#!/usr/bin/env node
// @ts-nocheck
'use strict';

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import _seed_bank_manager from './seed-bank-manager';
const { buildSeedBank, syncSeedBank } = _seed_bank_manager;
import _training_warehouse_manifest_utils from './training-warehouse-manifest-utils';
const { cleanupWarehouseSelfplayArtifacts } = _training_warehouse_manifest_utils;

import _load_training_profile from './load-training-profile';
const { resolveTrainingProfile, writeResolvedConfig, runCommand } = _load_training_profile;
import _training_command_args from './training-command-args';
const { collectCliFlagMap, getFlagValue, hasFlag } = _training_command_args;
import _training_profile_launcher_args from './training-profile-launcher-args';
const { parseTrainingProfileLauncherArgs, formatTrainingProfileLauncherHelp } = _training_profile_launcher_args;

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function parseArgs(argv: string[]) {
    return parseTrainingProfileLauncherArgs(argv, { mode: 'run' });
}

function printHelp() {
    console.log(formatTrainingProfileLauncherHelp({ mode: 'run' }));
}

function getNumericCommandFlagValue(flagMap: any, flag: any, fallback: any) {
    const raw = getFlagValue(flagMap, flag);
    if (raw == null) return fallback;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function buildSeedBankFromResolvedCommand(resolved: any) {
    const seedBankPlan = resolved && resolved.seedBankPlan && typeof resolved.seedBankPlan === 'object'
        ? resolved.seedBankPlan
        : null;
    if (seedBankPlan && seedBankPlan.path && seedBankPlan.gates && typeof seedBankPlan.gates === 'object') {
        return {
            seedBankPath: path.resolve(seedBankPlan.path),
            bank: buildSeedBank({
                bankId: seedBankPlan.bankId,
                description: seedBankPlan.description,
                gates: seedBankPlan.gates
            })
        };
    }

    const commandArgs = resolved && resolved.command && Array.isArray(resolved.command.args)
        ? resolved.command.args
        : [];
    const flagMap = collectCliFlagMap(commandArgs);
    const seedBankArg = getFlagValue(flagMap, '--seed-bank');
    if (!seedBankArg) return null;
    const baseSeed = getNumericCommandFlagValue(flagMap, '--seed', 1);
    const quickSeedCount = getNumericCommandFlagValue(
        flagMap,
        '--quick-adoption-seed-count',
        getNumericCommandFlagValue(flagMap, '--adoption-seed-count', 1)
    );
    const quickSeedStride = getNumericCommandFlagValue(
        flagMap,
        '--quick-adoption-seed-stride',
        getNumericCommandFlagValue(flagMap, '--adoption-seed-stride', 1000)
    );
    const quickSeedOffset = getNumericCommandFlagValue(flagMap, '--quick-adoption-seed-offset', 0);
    const finalSeedCount = getNumericCommandFlagValue(
        flagMap,
        '--final-adoption-seed-count',
        getNumericCommandFlagValue(flagMap, '--adoption-seed-count', 1)
    );
    const finalSeedStride = getNumericCommandFlagValue(
        flagMap,
        '--final-adoption-seed-stride',
        getNumericCommandFlagValue(flagMap, '--adoption-seed-stride', 1000)
    );
    const finalSeedOffset = getNumericCommandFlagValue(
        flagMap,
        '--adoption-final-seed-offset',
        getNumericCommandFlagValue(flagMap, '--eval-seed-offset', 500000)
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
        }
    };
    if (hasFlag(flagMap, '--quality-gate')) {
        gates.quality = {
            baseSeed: baseSeed + getNumericCommandFlagValue(flagMap, '--quality-gate-seed-offset', 250000),
            seedCount: getNumericCommandFlagValue(flagMap, '--quality-gate-seed-count', 1),
            seedStride: getNumericCommandFlagValue(flagMap, '--quality-gate-seed-stride', 1000),
            purpose: 'quality gate'
        };
    }
    gates.onnx = {
        baseSeed: baseSeed + getNumericCommandFlagValue(flagMap, '--onnx-gate-seed-offset', 700000),
        seedCount: getNumericCommandFlagValue(flagMap, '--onnx-gate-seed-count', 1),
        seedStride: getNumericCommandFlagValue(flagMap, '--onnx-gate-seed-stride', 1000),
        purpose: hasFlag(flagMap, '--onnx-gate')
            ? 'onnx gate'
            : 'onnx gate schedule'
    };
    return {
        seedBankPath: path.resolve(resolved && resolved.cwd ? resolved.cwd : process.cwd(), seedBankArg),
        bank: buildSeedBank({
            bankId: `${resolved && resolved.profile ? resolved.profile.name : 'training'}-seed-bank`,
            description: resolved && resolved.paths && resolved.paths.runTag
                ? `Auto-initialized seed bank for ${resolved.paths.runTag}`
                : 'Auto-initialized seed bank',
            gates
        })
    };
}

function ensureSeedBankInitialized(resolved: any, logger: any) {
    const out = logger && typeof logger.log === 'function'
        ? logger
        : { log: (message: any) => console.log(message) };
    const seedBankInit = buildSeedBankFromResolvedCommand(resolved);
    if (!seedBankInit || !seedBankInit.seedBankPath) return null;
    const synced = syncSeedBank(seedBankInit.seedBankPath, seedBankInit.bank);
    if (synced.created) {
        out.log(`[training-profile] seedBank initialized=${seedBankInit.seedBankPath}`);
    } else if (synced.updated) {
        out.log(`[training-profile] seedBank synchronized=${seedBankInit.seedBankPath}`);
    }
    return seedBankInit.seedBankPath;
}

function formatLauncherLogArchiveSuffix(date: Date) {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const millis = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}${month}${day}-${hours}${minutes}${seconds}-${millis}`;
}

function rotateLauncherLog(logPath: any) {
    if (!logPath || !fs.existsSync(logPath)) return null;
    const stat = fs.statSync(logPath);
    if (!stat.isFile() || stat.size <= 0) return null;

    const parsed = path.parse(logPath);
    const suffix = formatLauncherLogArchiveSuffix(new Date());
    let archivedPath = path.join(parsed.dir, `${parsed.name}.${suffix}${parsed.ext || '.log'}`);
    let counter = 1;
    while (fs.existsSync(archivedPath)) {
        archivedPath = path.join(parsed.dir, `${parsed.name}.${suffix}.${counter}${parsed.ext || '.log'}`);
        counter += 1;
    }
    fs.renameSync(logPath, archivedPath);
    return archivedPath;
}

function createLauncherLogger(logPath: any) {
    let stream = null;
    let archivedPath = null;
    if (logPath) {
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        archivedPath = rotateLauncherLog(logPath);
        stream = fs.createWriteStream(logPath, { flags: 'w', encoding: 'utf8' });
    }

    function writeToTargets(target: any, chunk: any) {
        if (chunk === null || chunk === undefined) return;
        target.write(chunk);
        if (stream) stream.write(chunk);
    }

    return {
        log(message: any) {
            writeToTargets(process.stdout, `${String(message || '')}\n`);
        },
        error(message: any) {
            writeToTargets(process.stderr, `${String(message || '')}\n`);
        },
        writeStdout(chunk: any) {
            writeToTargets(process.stdout, chunk);
        },
        writeStderr(chunk: any) {
            writeToTargets(process.stderr, chunk);
        },
        close() {
            if (!stream) return Promise.resolve();
            return new Promise((resolve: any, reject: any) => {
                stream.on('error', reject);
                stream.end(() => resolve());
            });
        },
        archivedPath
    };
}

function runCommandLogged(executable: any, args: any, options: any) {
    return new Promise((resolve: any, reject: any) => {
        const child = spawn(executable, args, {
            cwd: options && options.cwd ? options.cwd : process.cwd(),
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        const logger = options && options.logger ? options.logger : null;
        if (child.stdout) {
            child.stdout.on('data', (chunk: any) => {
                if (logger && typeof logger.writeStdout === 'function') {
                    logger.writeStdout(chunk);
                } else {
                    process.stdout.write(chunk);
                }
            });
        }
        if (child.stderr) {
            child.stderr.on('data', (chunk: any) => {
                if (logger && typeof logger.writeStderr === 'function') {
                    logger.writeStderr(chunk);
                } else {
                    process.stderr.write(chunk);
                }
            });
        }

        child.on('error', reject);
        child.on('close', (code: any) => {
            resolve({ status: Number.isFinite(code) ? code : 0 });
        });
    });
}

function readTrainingCycleFailureDetail(summaryPath: string) {
    if (!summaryPath || !fs.existsSync(summaryPath)) return null;
    try {
        const payload = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        return payload && payload.failure && typeof payload.failure === 'object'
            ? payload.failure
            : null;
    } catch (error) {
        return null;
    }
}

function annotateTrainingProfileError(error: any, context: any) {
    const detail = Object.assign({}, error && error.trainingProfile ? error.trainingProfile : null, context || {});
    detail.message = error && error.message ? error.message : String(error);
    const wrapped = new Error(detail.message);
    wrapped.code = detail.errorCode || (error && error.code) || 'TRAINING_PROFILE_FAILED';
    wrapped.trainingProfile = detail;
    wrapped.cause = error;
    return wrapped;
}

function buildTrainingProfileFailureReport(error: any) {
    const detail = error && error.trainingProfile ? error.trainingProfile : { message: error && error.message ? error.message : String(error) };
    const headline = ['[training-profile] failed:'];
    if (detail.phase) headline.push(`phase=${detail.phase}`);
    if (Number.isFinite(detail.exitCode)) headline.push(`exit=${detail.exitCode}`);
    if (detail.failureDetail && Number.isFinite(detail.failureDetail.iteration)) {
        headline.push(`iteration=${detail.failureDetail.iteration}`);
    }
    if (detail.failureDetail && detail.failureDetail.step) {
        headline.push(`step=${detail.failureDetail.step}`);
    }
    headline.push(detail.message || 'training profile failed');

    const lines = [headline.join(' ')];
    if (detail.profile) lines.push(`[training-profile] profile=${detail.profile}`);
    if (detail.gate) lines.push(`[training-profile] gate=${detail.gate}`);
    if (detail.runTag) lines.push(`[training-profile] runTag=${detail.runTag}`);
    if (detail.command) lines.push(`[training-profile] command=${detail.command}`);
    if (detail.summaryPath) lines.push(`[training-profile] summary=${detail.summaryPath}`);
    if (detail.preflightPath) lines.push(`[training-profile] preflight=${detail.preflightPath}`);
    if (detail.launcherLogPath) lines.push(`[training-profile] launcherLog=${detail.launcherLogPath}`);
    if (detail.failureDetail && detail.failureDetail.command) {
        lines.push(`[training-profile] failedCommand=${detail.failureDetail.command}`);
    }
    if (detail.failureDetail && Array.isArray(detail.failureDetail.stepOutputs) && detail.failureDetail.stepOutputs.length > 0) {
        lines.push(`[training-profile] stepOutputs=${detail.failureDetail.stepOutputs.join(', ')}`);
    }
    return lines;
}

function printResolvedBanner(resolved: any, logger: any) {
    const out = logger && typeof logger.log === 'function'
        ? logger
        : { log: (message: any) => console.log(message) };
    out.log(`[training-profile] profile=${resolved.profile.name}`);
    if (resolved.gate) {
        out.log(`[training-profile] gate=${resolved.gate.name}`);
    }
    out.log(`[training-profile] runTag=${resolved.paths.runTag}`);
    out.log(`[training-profile] runsDir=${resolved.paths.runsDir}`);
    out.log(`[training-profile] modelsDir=${resolved.paths.modelsDir}`);
    out.log(`[training-profile] config=${resolved.paths.resolvedConfigOut}`);
    out.log(`[training-profile] preflight=${resolved.paths.preflightOut}`);
    out.log(`[training-profile] summary=${resolved.paths.summaryOut}`);
    out.log(`[training-profile] launcherLog=${resolved.paths.launcherLogPath}`);
  }

async function runPreflight(resolved: any, logger: any) {
    if (!resolved.preflightCommand) return;
    const out = logger && typeof logger.log === 'function'
        ? logger
        : { log: (message: any) => console.log(message) };
    out.log(`[training-profile] preflight: ${resolved.preflightCommand.display}`);
    const result = await runCommandLogged(resolved.preflightCommand.executable, resolved.preflightCommand.args, {
        cwd: resolved.cwd,
        logger
    });
    if (result.status !== 0) {
        throw annotateTrainingProfileError(new Error(`preflight failed (exit=${result.status})`), {
            phase: 'preflight',
            exitCode: result.status,
            profile: resolved.profile.name,
            gate: resolved.gate ? resolved.gate.name : null,
            runTag: resolved.paths.runTag,
            command: resolved.preflightCommand.display,
            preflightPath: resolved.paths.preflightOut,
            launcherLogPath: resolved.paths.launcherLogPath
        });
    }
}

async function runTrainCycle(resolved: any, logger: any) {
    const out = logger && typeof logger.log === 'function'
        ? logger
        : { log: (message: any) => console.log(message) };
    out.log(`[training-profile] launch: ${resolved.command.display}`);
    const result = await runCommandLogged(resolved.command.executable, resolved.command.args, {
        cwd: resolved.cwd,
        logger
    });
    if (result.status !== 0) {
        throw annotateTrainingProfileError(new Error(`train-cycle failed (exit=${result.status})`), {
            phase: 'train-cycle',
            exitCode: result.status,
            profile: resolved.profile.name,
            gate: resolved.gate ? resolved.gate.name : null,
            runTag: resolved.paths.runTag,
            command: resolved.command.display,
            summaryPath: resolved.paths.summaryOut,
            launcherLogPath: resolved.paths.launcherLogPath,
            failureDetail: readTrainingCycleFailureDetail(resolved.paths.summaryOut)
        });
    }
}

function cleanupResolvedWarehouseArtifacts(resolved: any, logger: any) {
    const out = logger && typeof logger.log === 'function'
        ? logger
        : { log: (message: any) => console.log(message) };
    const runsDir = resolved && resolved.paths ? resolved.paths.runsDir : null;
    if (!runsDir) return null;
    const result = cleanupWarehouseSelfplayArtifacts(runsDir);
    if (result.removed.length > 0) {
        out.log(
            `[training-profile] cleaned historical selfplay artifacts=${result.removed.length} ` +
            `reclaimed=${result.totalBytesRemovedHuman}`
        );
    }
    if (result.failed.length > 0) {
        for (const failure of result.failed) {
            out.log(`[training-profile] cleanup warning path=${failure.path} error=${failure.error}`);
        }
    }
    return result;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    let resolved;
    try {
        resolved = resolveTrainingProfile(args.profile, {
            gateProfile: args.gateProfile,
            runTag: args.runTag,
            runsDir: args.runsDir,
            modelsDir: args.modelsDir,
            summaryOut: args.summaryOut,
            resolvedConfigOut: args.resolvedConfigOut,
            preflightOut: args.preflightOut,
            launcherLogPath: args.launcherLogPath,
            pythonPath: args.pythonPath,
            refreshBootstrap: args.refreshBootstrap,
            passThrough: args.passThrough
        });
    } catch (error) {
        throw annotateTrainingProfileError(error, {
            phase: 'resolve-profile',
            profile: args.profile,
            gate: args.gateProfile || null
        });
    }

    const logger = createLauncherLogger(resolved.paths && resolved.paths.launcherLogPath ? resolved.paths.launcherLogPath : null);

    try {
        writeResolvedConfig(resolved, args.resolvedConfigOut || null);
        printResolvedBanner(resolved, logger);

        if (!args.dryRun) {
            cleanupResolvedWarehouseArtifacts(resolved, logger);
        }

        if (!args.skipPreflight) {
            await runPreflight(resolved, logger);
        }

        ensureSeedBankInitialized(resolved, logger);

        if (args.dryRun) {
            logger.log('[training-profile] dry-run complete');
            return;
        }

        await runTrainCycle(resolved, logger);
    } catch (error) {
        if (error && error.trainingProfile) {
            throw error;
        }
        throw annotateTrainingProfileError(error, {
            phase: 'launcher',
            profile: resolved.profile.name,
            gate: resolved.gate ? resolved.gate.name : null,
            runTag: resolved.paths.runTag,
            summaryPath: resolved.paths.summaryOut,
            preflightPath: resolved.paths.preflightOut,
            launcherLogPath: resolved.paths.launcherLogPath
        });
    } finally {
        await logger.close();
    }
}

if (require.main === module) {
    Promise.resolve(main()).catch((err: any) => {
        const lines = buildTrainingProfileFailureReport(err);
        for (const line of lines) {
            console.error(line);
        }
        process.exit(1);
    });
}

export = {
    parseArgs,
    createLauncherLogger,
    runCommandLogged,
    readTrainingCycleFailureDetail,
    annotateTrainingProfileError,
    buildTrainingProfileFailureReport,
    buildSeedBankFromResolvedCommand,
    ensureSeedBankInitialized,
    cleanupResolvedWarehouseArtifacts
};
