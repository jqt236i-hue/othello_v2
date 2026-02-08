#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
    const args = {
        adoptionResultPath: null,
        candidateModelPath: null,
        targetModelPath: path.resolve(process.cwd(), 'data', 'models', 'policy-table.json'),
        force: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--adoption-result') { args.adoptionResultPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--candidate-model') { args.candidateModelPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--target-model') { args.targetModelPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--force') { args.force = true; continue; }
    }

    if (args.help) return args;
    if (!args.adoptionResultPath) throw new Error('--adoption-result is required');
    if (!args.candidateModelPath) throw new Error('--candidate-model is required');
    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/promote-policy-model.js [options]',
        '',
        'Options:',
        '      --adoption-result <path>  Adoption check JSON (required)',
        '      --candidate-model <path>  Candidate policy model JSON (required)',
        '      --target-model <path>     Promotion target path (default: data/models/policy-table.json)',
        '      --force                   Ignore adoption decision and promote anyway',
        '  -h, --help                    Show this help'
    ].join('\n'));
}

function readJson(p) {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
}

function validatePolicyModel(model) {
    if (!model || typeof model !== 'object') throw new Error('candidate model is not an object');
    if (model.schemaVersion !== 'policy_table.v1') throw new Error('candidate model schema must be policy_table.v1');
    if (!model.states || typeof model.states !== 'object') throw new Error('candidate model must include states object');
}

function promoteModel(options) {
    const adoption = readJson(options.adoptionResultPath);
    const decision = adoption && adoption.decision ? adoption.decision : null;
    if (!options.force) {
        if (!decision || decision.passed !== true) {
            throw new Error('adoption decision is not passed; use --force to override');
        }
    }

    const candidate = readJson(options.candidateModelPath);
    validatePolicyModel(candidate);

    const targetDir = path.dirname(options.targetModelPath);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(options.candidateModelPath, options.targetModelPath);
    return {
        targetModelPath: options.targetModelPath,
        candidateModelPath: options.candidateModelPath,
        forced: !!options.force,
        promotedAt: new Date().toISOString()
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { printHelp(); return; }
    const result = promoteModel(args);
    console.log(`[policy-promote] promoted model -> ${result.targetModelPath} (forced=${result.forced})`);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[policy-promote] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    promoteModel
};
