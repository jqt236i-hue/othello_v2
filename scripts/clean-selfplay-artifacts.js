#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
    const args = {
        runsDir: path.resolve(process.cwd(), 'data', 'runs'),
        modelsDir: path.resolve(process.cwd(), 'data', 'models'),
        apply: false,
        keepDeployed: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--runs-dir') { args.runsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--models-dir') { args.modelsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--apply') { args.apply = true; continue; }
        if (a === '--keep-deployed') { args.keepDeployed = true; continue; }
    }

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/clean-selfplay-artifacts.js [options]',
        '',
        'Options:',
        '      --runs-dir <path>      Runs directory (default: data/runs)',
        '      --models-dir <path>    Models directory (default: data/models)',
        '      --apply                Delete listed files (default: dry-run)',
        '      --keep-deployed        Keep deployed models (policy-table.json, policy-net.onnx, policy-net.onnx.meta.json)',
        '  -h, --help                 Show this help'
    ].join('\n'));
}

function listFilesRecursive(baseDir) {
    if (!fs.existsSync(baseDir)) return [];
    const out = [];
    const stack = [baseDir];
    while (stack.length > 0) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(full);
                continue;
            }
            if (entry.isFile()) out.push(full);
        }
    }
    return out;
}

function shouldDeleteModelFile(fileName, keepDeployed) {
    const lower = fileName.toLowerCase();
    const isCheckpoint = lower.endsWith('.checkpoint.pt');
    const isPolicyTable = lower.startsWith('policy-table') && lower.endsWith('.json');
    const isPolicyNet = lower.startsWith('policy-net') && (lower.endsWith('.onnx') || lower.endsWith('.meta.json'));
    if (!isCheckpoint && !isPolicyTable && !isPolicyNet) return false;
    if (!keepDeployed) return true;
    if (lower === 'policy-table.json') return false;
    if (lower === 'policy-net.onnx') return false;
    if (lower === 'policy-net.onnx.meta.json') return false;
    return true;
}

function collectTargets(args) {
    const runsFiles = listFilesRecursive(args.runsDir);
    const modelFiles = fs.existsSync(args.modelsDir)
        ? fs.readdirSync(args.modelsDir, { withFileTypes: true })
            .filter((d) => d.isFile() && shouldDeleteModelFile(d.name, args.keepDeployed))
            .map((d) => path.join(args.modelsDir, d.name))
        : [];
    const targets = runsFiles.concat(modelFiles);
    targets.sort();
    return targets;
}

function formatBytes(n) {
    if (!Number.isFinite(n) || n <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = n;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx += 1;
    }
    return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function summarizeTargets(targets) {
    const totalBytes = targets.reduce((sum, p) => {
        try {
            return sum + fs.statSync(p).size;
        } catch (e) {
            return sum;
        }
    }, 0);
    return {
        files: targets.length,
        totalBytes,
        totalBytesHuman: formatBytes(totalBytes)
    };
}

function removeTargets(targets) {
    const deleted = [];
    const failed = [];
    for (const p of targets) {
        try {
            fs.unlinkSync(p);
            deleted.push(p);
        } catch (err) {
            failed.push({ path: p, error: err && err.message ? err.message : String(err) });
        }
    }
    return { deleted, failed };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const targets = collectTargets(args);
    const summary = summarizeTargets(targets);
    console.log(`[selfplay-clean] targets=${summary.files} size=${summary.totalBytesHuman}`);

    if (!args.apply) {
        const previewCount = Math.min(30, targets.length);
        if (previewCount > 0) {
            console.log('[selfplay-clean] dry-run preview:');
            for (let i = 0; i < previewCount; i++) {
                console.log(`  ${targets[i]}`);
            }
            if (targets.length > previewCount) {
                console.log(`  ... and ${targets.length - previewCount} more`);
            }
        }
        console.log('[selfplay-clean] dry-run only. Use --apply to delete.');
        return;
    }

    const result = removeTargets(targets);
    console.log(`[selfplay-clean] deleted=${result.deleted.length} failed=${result.failed.length}`);
    if (result.failed.length > 0) {
        for (const failure of result.failed) {
            console.error(`[selfplay-clean] failed: ${failure.path} :: ${failure.error}`);
        }
        process.exit(1);
    }
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[selfplay-clean] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    collectTargets,
    shouldDeleteModelFile,
    summarizeTargets,
    formatBytes
};

