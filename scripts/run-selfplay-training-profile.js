#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const {
    resolveTrainingProfile,
    writeResolvedConfig,
    runCommand
} = require('./load-training-profile');

function parseArgs(argv) {
    const args = {
        profile: 'production_v2',
        gateProfile: null,
        runTag: null,
        runsDir: null,
        modelsDir: null,
        summaryOut: null,
        resolvedConfigOut: null,
        preflightOut: null,
        launcherLogPath: null,
        pythonPath: null,
        refreshBootstrap: false,
        skipPreflight: false,
        dryRun: false,
        passThrough: [],
        help: false
    };

    let passThroughMode = false;
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (passThroughMode) {
            args.passThrough.push(token);
            continue;
        }
        if (token === '--') { passThroughMode = true; continue; }
        if (token === '--help' || token === '-h') { args.help = true; continue; }
        if (token === '--profile') { args.profile = String(argv[++i] || '').trim() || 'production_v2'; continue; }
        if (token === '--gate-profile') { args.gateProfile = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--run-tag') { args.runTag = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--runs-dir') { args.runsDir = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--models-dir') { args.modelsDir = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--summary-out') { args.summaryOut = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--resolved-config-out' || token === '--out') { args.resolvedConfigOut = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--preflight-out') { args.preflightOut = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--launcher-log') { args.launcherLogPath = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--python') { args.pythonPath = String(argv[++i] || '').trim() || null; continue; }
        if (token === '--refresh-bootstrap') { args.refreshBootstrap = true; continue; }
        if (token === '--skip-preflight') { args.skipPreflight = true; continue; }
        if (token === '--dry-run') { args.dryRun = true; continue; }
        args.passThrough.push(token);
    }

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/run-selfplay-training-profile.js [options] [-- extra-options-for-train-cycle]',
        '',
        'Options:',
        '      --profile <name|path>      Training profile name/path (default: production_v2)',
        '      --gate-profile <name|path> Override gate profile name/path',
        '      --run-tag <tag>            Fixed run tag',
        '      --runs-dir <path>          Override runs directory',
        '      --models-dir <path>        Override models directory',
        '      --summary-out <path>       Override training summary output path',
        '      --resolved-config-out <p>  Override resolved config output path',
        '      --preflight-out <path>     Override preflight report path',
        '      --launcher-log <path>      Override launcher log path hint',
        '      --python <path>            Override Python executable path',
        '      --refresh-bootstrap        Re-copy bootstrap models even if target exists',
        '      --skip-preflight           Skip preflight check',
        '      --dry-run                  Resolve profile, write config, run preflight only',
        '  -h, --help                     Show this help',
        '',
        'Example:',
        '  node scripts/run-selfplay-training-profile.js --profile production_v2 -- --max-hours 100'
    ].join('\n'));
}

function formatLauncherLogArchiveSuffix(date) {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const millis = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}${month}${day}-${hours}${minutes}${seconds}-${millis}`;
}

function rotateLauncherLog(logPath) {
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

function createLauncherLogger(logPath) {
    let stream = null;
    let archivedPath = null;
    if (logPath) {
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        archivedPath = rotateLauncherLog(logPath);
        stream = fs.createWriteStream(logPath, { flags: 'w', encoding: 'utf8' });
    }

    function writeToTargets(target, chunk) {
        if (chunk === null || chunk === undefined) return;
        target.write(chunk);
        if (stream) stream.write(chunk);
    }

    return {
        log(message) {
            writeToTargets(process.stdout, `${String(message || '')}\n`);
        },
        error(message) {
            writeToTargets(process.stderr, `${String(message || '')}\n`);
        },
        writeStdout(chunk) {
            writeToTargets(process.stdout, chunk);
        },
        writeStderr(chunk) {
            writeToTargets(process.stderr, chunk);
        },
        close() {
            if (!stream) return Promise.resolve();
            return new Promise((resolve, reject) => {
                stream.on('error', reject);
                stream.end(() => resolve());
            });
        },
        archivedPath
    };
}

function runCommandLogged(executable, args, options) {
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, {
            cwd: options && options.cwd ? options.cwd : process.cwd(),
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        const logger = options && options.logger ? options.logger : null;
        if (child.stdout) {
            child.stdout.on('data', (chunk) => {
                if (logger && typeof logger.writeStdout === 'function') {
                    logger.writeStdout(chunk);
                } else {
                    process.stdout.write(chunk);
                }
            });
        }
        if (child.stderr) {
            child.stderr.on('data', (chunk) => {
                if (logger && typeof logger.writeStderr === 'function') {
                    logger.writeStderr(chunk);
                } else {
                    process.stderr.write(chunk);
                }
            });
        }

        child.on('error', reject);
        child.on('close', (code) => {
            resolve({ status: Number.isFinite(code) ? code : 0 });
        });
    });
}

function readTrainingCycleFailureDetail(summaryPath) {
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

function annotateTrainingProfileError(error, context) {
    const detail = Object.assign({}, error && error.trainingProfile ? error.trainingProfile : null, context || {});
    detail.message = error && error.message ? error.message : String(error);
    const wrapped = new Error(detail.message);
    wrapped.code = detail.errorCode || (error && error.code) || 'TRAINING_PROFILE_FAILED';
    wrapped.trainingProfile = detail;
    wrapped.cause = error;
    return wrapped;
}

function buildTrainingProfileFailureReport(error) {
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

function printResolvedBanner(resolved, logger) {
    const out = logger && typeof logger.log === 'function'
        ? logger
        : { log: (message) => console.log(message) };
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

async function runPreflight(resolved, logger) {
    if (!resolved.preflightCommand) return;
    const out = logger && typeof logger.log === 'function'
        ? logger
        : { log: (message) => console.log(message) };
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

async function runTrainCycle(resolved, logger) {
    const out = logger && typeof logger.log === 'function'
        ? logger
        : { log: (message) => console.log(message) };
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

        if (!args.skipPreflight) {
            await runPreflight(resolved, logger);
        }

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
    Promise.resolve(main()).catch((err) => {
        const lines = buildTrainingProfileFailureReport(err);
        for (const line of lines) {
            console.error(line);
        }
        process.exit(1);
    });
}

module.exports = {
    parseArgs,
    createLauncherLogger,
    runCommandLogged,
    readTrainingCycleFailureDetail,
    annotateTrainingProfileError,
    buildTrainingProfileFailureReport
};
