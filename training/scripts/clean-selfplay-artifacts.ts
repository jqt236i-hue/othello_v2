#!/usr/bin/env node

'use strict';

import * as fs from 'fs';
import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function parseArgs(argv: string[]) {
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
        '      --keep-deployed        Keep deployed models (policy-table.json, policy-net.onnx, policy-net.onnx.meta.json, policy-card.onnx, policy-card.onnx.meta.json, policy-target.onnx, policy-target.onnx.meta.json, policy-value.onnx, policy-value.onnx.meta.json)',
        '  -h, --help                 Show this help'
    ].join('\n'));
}

function listFilesRecursive(baseDir: string) {
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

function listResumeChunkDirs(baseDir: string) {
    if (!fs.existsSync(baseDir)) return [];
    const out = [];
    const stack = [baseDir];
    while (stack.length > 0) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (!entry.isDirectory()) continue;
            if (entry.name.endsWith('.resume-chunks')) {
                out.push(full);
                continue;
            }
            stack.push(full);
        }
    }
    return out;
}

function shouldDeleteModelFile(fileName: any, keepDeployed: any) {
    const lower = fileName.toLowerCase();
    const isCheckpoint = lower.endsWith('.checkpoint.pt');
    const isPolicyTable = lower.startsWith('policy-table') && lower.endsWith('.json');
    const isPolicyNet = lower.startsWith('policy-net') && (lower.endsWith('.onnx') || lower.endsWith('.meta.json'));
    const isPolicyCard = lower.startsWith('policy-card') && (lower.endsWith('.onnx') || lower.endsWith('.meta.json'));
    const isPolicyTarget = lower.startsWith('policy-target') && (lower.endsWith('.onnx') || lower.endsWith('.meta.json'));
    const isPolicyValue = lower.startsWith('policy-value') && (lower.endsWith('.onnx') || lower.endsWith('.meta.json'));
    if (!isCheckpoint && !isPolicyTable && !isPolicyNet && !isPolicyCard && !isPolicyTarget && !isPolicyValue) return false;
    if (!keepDeployed) return true;
    if (lower === 'policy-table.json') return false;
    if (lower === 'policy-net.onnx') return false;
    if (lower === 'policy-net.onnx.meta.json') return false;
    if (lower === 'policy-card.onnx') return false;
    if (lower === 'policy-card.onnx.meta.json') return false;
    if (lower === 'policy-target.onnx') return false;
    if (lower === 'policy-target.onnx.meta.json') return false;
    if (lower === 'policy-value.onnx') return false;
    if (lower === 'policy-value.onnx.meta.json') return false;
    return true;
}

function isIgnorableRunArtifact(filePath: any) {
    const baseName = path.basename(String(filePath || ''));
    return /^preflight\.\d+\.json$/i.test(baseName);
}

function collectTargets(args: any) {
    const runsDirs = listResumeChunkDirs(args.runsDir);
    const runsDirSet = new Set(runsDirs.map((one: any) => path.resolve(one)));
    const runsFiles = listFilesRecursive(args.runsDir).filter((onePath: any) => {
        if (isIgnorableRunArtifact(onePath)) return false;
        const resolved = path.resolve(onePath);
        for (const dirPath of runsDirSet) {
            if (resolved.startsWith(`${dirPath}${path.sep}`)) {
                return false;
            }
        }
        return true;
    });
    const modelFiles = fs.existsSync(args.modelsDir)
        ? fs.readdirSync(args.modelsDir, { withFileTypes: true })
            .filter((d: any) => d.isFile() && shouldDeleteModelFile(d.name, args.keepDeployed))
            .map((d: any) => path.join(args.modelsDir, d.name))
        : [];
    const targets = runsFiles.concat(runsDirs, modelFiles);
    targets.sort();
    return targets;
}

function formatBytes(n: number) {
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

function summarizeTargets(targets: any[]) {
    const totalBytes = targets.reduce((sum: any, p: any) => {
        try {
            const stat = fs.statSync(p);
            if (stat.isDirectory()) {
                return sum + listFilesRecursive(p).reduce((dirSum: any, oneFile: any) => {
                    try {
                        return dirSum + fs.statSync(oneFile).size;
                    } catch (e) {
                        return dirSum;
                    }
                }, 0);
            }
            return sum + stat.size;
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

function removeTargets(targets: any[]) {
    const deleted = [];
    const failed = [];
    for (const p of targets) {
        try {
            const stat = fs.statSync(p);
            if (stat.isDirectory()) {
                fs.rmSync(p, { recursive: true, force: false });
            } else {
                fs.unlinkSync(p);
            }
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

export = {
    parseArgs,
    collectTargets,
    shouldDeleteModelFile,
    isIgnorableRunArtifact,
    summarizeTargets,
    formatBytes
};
