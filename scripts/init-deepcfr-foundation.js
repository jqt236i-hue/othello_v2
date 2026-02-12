#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function makeStamp() {
    return new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);
}

function makeDefaultManifestPath(runsDir) {
    return path.resolve(runsDir, `deepcfr.foundation.${makeStamp()}.json`);
}

function buildDirectoryList(deepcfrDir) {
    return [
        path.resolve(deepcfrDir),
        path.resolve(deepcfrDir, 'buffers'),
        path.resolve(deepcfrDir, 'checkpoints'),
        path.resolve(deepcfrDir, 'datasets'),
        path.resolve(deepcfrDir, 'exports'),
        path.resolve(deepcfrDir, 'logs'),
        path.resolve(deepcfrDir, 'reports')
    ];
}

function parseArgs(argv) {
    const runsDir = path.resolve(process.cwd(), 'data', 'runs');
    const deepcfrDir = path.resolve(process.cwd(), 'data', 'deepcfr');
    const args = {
        runsDir,
        deepcfrDir,
        configTemplatePath: path.resolve(process.cwd(), 'ai', 'train', 'deepcfr_config.base.yaml'),
        configOutPath: path.resolve(deepcfrDir, 'deepcfr_config.active.yaml'),
        manifestOut: makeDefaultManifestPath(runsDir),
        copyConfig: true,
        forceConfig: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--runs-dir') { args.runsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--deepcfr-dir') { args.deepcfrDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--config-template') { args.configTemplatePath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--config-out') { args.configOutPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--manifest-out') { args.manifestOut = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--no-copy-config') { args.copyConfig = false; continue; }
        if (a === '--force-config') { args.forceConfig = true; continue; }
    }

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/init-deepcfr-foundation.js [options]',
        '',
        'Options:',
        '      --runs-dir <path>         Runs directory (default: data/runs)',
        '      --deepcfr-dir <path>      DeepCFR work directory (default: data/deepcfr)',
        '      --config-template <path>  Base config template path (default: ai/train/deepcfr_config.base.yaml)',
        '      --config-out <path>       Active config output path (default: data/deepcfr/deepcfr_config.active.yaml)',
        '      --manifest-out <path>     Output manifest JSON path',
        '      --no-copy-config          Skip base config copy',
        '      --force-config            Overwrite active config when it already exists',
        '  -h, --help                    Show this help'
    ].join('\n'));
}

function copyConfigIfNeeded(args) {
    if (!args.copyConfig) {
        return {
            copied: false,
            skipped: true,
            reason: 'copy-disabled'
        };
    }
    if (!fs.existsSync(args.configTemplatePath)) {
        throw new Error(`config template not found: ${args.configTemplatePath}`);
    }
    fs.mkdirSync(path.dirname(args.configOutPath), { recursive: true });
    if (fs.existsSync(args.configOutPath) && !args.forceConfig) {
        return {
            copied: false,
            skipped: true,
            reason: 'already-exists'
        };
    }
    fs.copyFileSync(args.configTemplatePath, args.configOutPath);
    return {
        copied: true,
        skipped: false,
        reason: null
    };
}

function initializeFoundation(args) {
    fs.mkdirSync(args.runsDir, { recursive: true });
    const directories = buildDirectoryList(args.deepcfrDir);
    for (const one of directories) fs.mkdirSync(one, { recursive: true });

    const configCopyResult = copyConfigIfNeeded(args);

    const manifest = {
        generatedAt: new Date().toISOString(),
        deepcfrDir: args.deepcfrDir,
        directories,
        configTemplatePath: args.configTemplatePath,
        configOutPath: args.configOutPath,
        configCopyResult
    };
    fs.mkdirSync(path.dirname(args.manifestOut), { recursive: true });
    fs.writeFileSync(args.manifestOut, JSON.stringify(manifest, null, 2), 'utf8');
    return manifest;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const manifest = initializeFoundation(args);
    console.log(`[deepcfr-init] deepcfrDir=${manifest.deepcfrDir}`);
    console.log(`[deepcfr-init] configOut=${manifest.configOutPath}`);
    console.log(`[deepcfr-init] manifest=${args.manifestOut}`);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[deepcfr-init] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    makeDefaultManifestPath,
    buildDirectoryList,
    initializeFoundation
};
