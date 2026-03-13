#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { isHardcaseRecord } = require('./extract-hardcases');

function buildDefaultSummaryOutPath(inputPath) {
    const resolved = path.resolve(process.cwd(), String(inputPath || 'data/selfplay.hardcase.ndjson'));
    const ext = path.extname(resolved) || '.ndjson';
    return `${resolved.slice(0, -ext.length)}.summary.json`;
}

function incrementCounter(map, key) {
    const safeKey = String(key || 'unknown').trim() || 'unknown';
    map[safeKey] = Number(map[safeKey] || 0) + 1;
}

async function summarizeHardcaseFile(inputPath) {
    const resolvedInputPath = path.resolve(process.cwd(), String(inputPath || ''));
    if (!resolvedInputPath || !fs.existsSync(resolvedInputPath)) {
        throw new Error(`input file not found: ${resolvedInputPath || '(empty)'}`);
    }
    const summary = {
        schemaVersion: 'hardcase_summary.v1',
        generatedAt: new Date().toISOString(),
        inputPath: resolvedInputPath,
        recordsRead: 0,
        hardcaseRecords: 0,
        parseErrors: 0,
        hardcaseTagCounts: {},
        primaryTagCounts: {},
        actionTypeCounts: {},
        pendingTypeCounts: {},
        seedFamilyCounts: {},
        dataLaneCounts: {}
    };
    const reader = readline.createInterface({
        input: fs.createReadStream(resolvedInputPath, { encoding: 'utf8' }),
        crlfDelay: Infinity
    });
    for await (const rawLine of reader) {
        const line = String(rawLine || '').trim();
        if (!line) continue;
        summary.recordsRead += 1;
        let record = null;
        try {
            record = JSON.parse(line);
        } catch (_) {
            summary.parseErrors += 1;
            continue;
        }
        if (!isHardcaseRecord(record)) continue;
        summary.hardcaseRecords += 1;
        incrementCounter(summary.actionTypeCounts, record && record.actionType ? record.actionType : 'unknown');
        incrementCounter(summary.pendingTypeCounts, record && record.pendingType ? record.pendingType : 'none');
        incrementCounter(summary.seedFamilyCounts, record && record.seedFamily ? record.seedFamily : 'unknown');
        incrementCounter(summary.dataLaneCounts, record && record.dataLane ? record.dataLane : 'unknown');
        incrementCounter(summary.primaryTagCounts, record && record.hardcasePrimaryTag ? record.hardcasePrimaryTag : 'unknown');
        const tags = Array.isArray(record && record.hardcaseTags) ? record.hardcaseTags : [];
        for (const tag of tags) incrementCounter(summary.hardcaseTagCounts, tag);
    }
    summary.generatedAt = new Date().toISOString();
    return summary;
}

function parseArgs(argv) {
    const args = {
        input: '',
        out: '',
        help: false
    };
    for (let i = 0; i < argv.length; i++) {
        const token = String(argv[i] || '');
        if (token === '--help' || token === '-h') { args.help = true; continue; }
        if (token === '--input') { args.input = String(argv[++i] || '').trim(); continue; }
        if (token === '--out' || token === '-o') { args.out = String(argv[++i] || '').trim(); continue; }
    }
    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/export-hardcase-summary.js --input <hardcase.ndjson> [options]',
        '',
        'Options:',
        '      --input <path>  Input hardcase NDJSON path',
        '  -o, --out <path>    Output summary JSON path',
        '  -h, --help          Show this help'
    ].join('\n'));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }
    if (!args.input) throw new Error('--input is required');
    const summary = await summarizeHardcaseFile(args.input);
    const outputPath = args.out
        ? path.resolve(process.cwd(), args.out)
        : buildDefaultSummaryOutPath(args.input);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`[hardcase-summary] out=${outputPath}`);
    console.log(`[hardcase-summary] hardcases=${summary.hardcaseRecords}/${summary.recordsRead} parseErrors=${summary.parseErrors}`);
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[hardcase-summary] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = {
    summarizeHardcaseFile
};
