#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const TEACHER_SOLUTION_SCHEMA_VERSION = 'teacher_solution.v1';
const TEACHER_SOLUTION_METHOD = 'selfplay.committee_hardcase.v1';
const NO_CARD_ACTION_ID = '__no_card__';

function buildDefaultTeacherSolutionOutPath(inputPath) {
    const resolvedInputPath = path.resolve(process.cwd(), String(inputPath || 'data/selfplay.hardcase.ndjson'));
    const dir = path.dirname(resolvedInputPath);
    const ext = path.extname(resolvedInputPath) || '.ndjson';
    const rawBase = path.basename(resolvedInputPath, ext);
    const hardcaseTagged = rawBase.match(/^selfplay\.(?:train|eval)\.hardcase\.(.+)$/i);
    if (hardcaseTagged && hardcaseTagged[1]) {
        return path.join(dir, `teacher_solution.${hardcaseTagged[1]}${ext}`);
    }
    if (/\.hardcase$/i.test(rawBase)) {
        return path.join(dir, `${rawBase.replace(/\.hardcase$/i, '')}.teacher_solution${ext}`);
    }
    return path.join(dir, `${rawBase}.teacher_solution${ext}`);
}

function isHardcaseRecord(record) {
    if (!record || typeof record !== 'object') return false;
    if (record.isHardcase === true) return true;
    return Array.isArray(record.hardcaseTags) && record.hardcaseTags.length > 0;
}

function cloneJsonRecord(record) {
    return JSON.parse(JSON.stringify(record || {}));
}

function normalizeCardId(value) {
    return (typeof value === 'string' && value.trim()) ? value.trim() : null;
}

function inferTeacherDecisionKind(record) {
    const actionType = String(record && record.actionType ? record.actionType : '');
    if (actionType === 'use_card') return 'use';
    if (actionType === 'destroy_hand_card') return 'destroy';
    if (actionType === 'cancel_card') return 'keep';
    if (actionType === 'place' && normalizeCardId(record && record.sellCardId)) return 'sell';
    if (actionType === 'place') return 'place';
    if (actionType === 'pass') return 'pass';
    return actionType || 'unknown';
}

function resolveSelectedCardId(record, decisionKind) {
    if (decisionKind === 'use') return normalizeCardId(record && record.useCardId);
    if (decisionKind === 'destroy') return normalizeCardId(record && record.destroyCardId);
    if (decisionKind === 'sell') return normalizeCardId(record && record.sellCardId);
    return null;
}

function buildPlaceTeacherCandidates(record) {
    const selectedRow = Number.isInteger(record && record.row) ? Number(record.row) : null;
    const selectedCol = Number.isInteger(record && record.col) ? Number(record.col) : null;
    const topCandidates = Array.isArray(record && record.topPlacementCandidates)
        ? record.topPlacementCandidates
        : [];
    if (topCandidates.length > 0) {
        return topCandidates.map((one) => {
            const row = Number.isInteger(one && one.row) ? Number(one.row) : null;
            const col = Number.isInteger(one && one.col) ? Number(one.col) : null;
            return {
                actionType: 'place',
                row,
                col,
                seat: typeof (one && one.seat) === 'string' ? one.seat : 'unknown',
                isSelected: row === selectedRow && col === selectedCol,
                combinedScore: Number.isFinite(one && one.combinedScore) ? Number(one.combinedScore) : null,
                tacticalScore: Number.isFinite(one && one.tacticalScore) ? Number(one.tacticalScore) : null,
                heuristicScore: Number.isFinite(one && one.heuristicScore) ? Number(one.heuristicScore) : null,
                policyScore: Number.isFinite(one && one.policyScore) ? Number(one.policyScore) : null,
                finalScore: Number.isFinite(one && one.finalScore) ? Number(one.finalScore) : null,
                committeeVotes: Number.isFinite(one && one.committeeVotes) ? Number(one.committeeVotes) : 0
            };
        });
    }
    if (selectedRow === null || selectedCol === null) return [];
    return [{
        actionType: 'place',
        row: selectedRow,
        col: selectedCol,
        seat: 'unknown',
        isSelected: true,
        combinedScore: null,
        tacticalScore: null,
        heuristicScore: null,
        policyScore: null,
        finalScore: null,
        committeeVotes: 0
    }];
}

function buildCardTeacherCandidates(record, decisionKind, selectedCardId) {
    const baseIds = (decisionKind === 'destroy' || decisionKind === 'sell')
        ? (Array.isArray(record && record.handCards) ? record.handCards : [])
        : (Array.isArray(record && record.usableCardIds) ? record.usableCardIds : []);
    const ids = [];
    const seen = new Set();
    for (const rawId of baseIds) {
        const cardId = normalizeCardId(rawId);
        if (!cardId || seen.has(cardId)) continue;
        seen.add(cardId);
        ids.push(cardId);
    }
    if (selectedCardId && !seen.has(selectedCardId)) {
        ids.push(selectedCardId);
    }

    const candidates = [];
    if (decisionKind === 'keep') {
        candidates.push({
            actionType: 'cancel_card',
            decisionKind: 'keep',
            cardId: NO_CARD_ACTION_ID,
            isSelected: true
        });
    }
    for (const cardId of ids) {
        candidates.push({
            actionType: decisionKind === 'destroy'
                ? 'destroy_hand_card'
                : (decisionKind === 'keep' ? 'use_card' : (decisionKind === 'sell' ? 'place' : 'use_card')),
            decisionKind,
            cardId,
            isSelected: cardId === selectedCardId
        });
    }
    return candidates;
}

function buildTeacherCandidates(record, decisionKind, selectedCardId) {
    if (decisionKind === 'place') {
        return buildPlaceTeacherCandidates(record);
    }
    if (decisionKind === 'use' || decisionKind === 'destroy' || decisionKind === 'sell' || decisionKind === 'keep') {
        return buildCardTeacherCandidates(record, decisionKind, selectedCardId);
    }
    return [];
}

function buildSelectedActionKey(record, decisionKind, selectedCardId) {
    if (decisionKind === 'place') {
        if (!Number.isInteger(record && record.row) || !Number.isInteger(record && record.col)) return null;
        return `place:${Number(record.row)}:${Number(record.col)}`;
    }
    if (decisionKind === 'sell') {
        if (!selectedCardId) return null;
        return `sell:${selectedCardId}`;
    }
    if (decisionKind === 'use') {
        if (!selectedCardId) return null;
        return `use:${selectedCardId}`;
    }
    if (decisionKind === 'destroy') {
        if (!selectedCardId) return null;
        return `destroy:${selectedCardId}`;
    }
    if (decisionKind === 'keep') {
        return 'keep';
    }
    return String(record && record.actionType ? record.actionType : 'unknown');
}

function toTeacherSolutionRecord(record, options) {
    const safeOptions = options || {};
    const output = cloneJsonRecord(record);
    const previousSchemaVersion = output.schemaVersion || null;
    const decisionKind = inferTeacherDecisionKind(record);
    const selectedCardId = resolveSelectedCardId(record, decisionKind);
    output.schemaVersion = TEACHER_SOLUTION_SCHEMA_VERSION;
    output.sourceSchemaVersion = previousSchemaVersion;
    output.teacherSolution = {
        method: TEACHER_SOLUTION_METHOD,
        decisionKind,
        selectedActionKey: buildSelectedActionKey(record, decisionKind, selectedCardId),
        selectedCardId,
        source: {
            inputPath: safeOptions.inputPath || null,
            lineNumber: Number.isFinite(safeOptions.lineNumber) ? Number(safeOptions.lineNumber) : null,
            gameIndex: Number.isFinite(record && record.gameIndex) ? Number(record.gameIndex) : null,
            ply: Number.isFinite(record && record.ply) ? Number(record.ply) : null,
            turnNumber: Number.isFinite(record && record.turnNumber) ? Number(record.turnNumber) : null,
            seed: Number.isFinite(record && record.seed) ? Number(record.seed) : null
        },
        hardcaseTags: Array.isArray(record && record.hardcaseTags) ? record.hardcaseTags.slice() : [],
        hardcasePrimaryTag: normalizeCardId(record && record.hardcasePrimaryTag) || record.hardcasePrimaryTag || null,
        actorView: record && record.actorView && typeof record.actorView === 'object'
            ? cloneJsonRecord(record.actorView)
            : null,
        decision: {
            actionType: record && record.actionType ? String(record.actionType) : null,
            row: Number.isInteger(record && record.row) ? Number(record.row) : null,
            col: Number.isInteger(record && record.col) ? Number(record.col) : null,
            useCardId: normalizeCardId(record && record.useCardId),
            destroyCardId: normalizeCardId(record && record.destroyCardId),
            sellCardId: normalizeCardId(record && record.sellCardId),
            pendingSelection: record && record.pendingSelection && typeof record.pendingSelection === 'object'
                ? cloneJsonRecord(record.pendingSelection)
                : null
        },
        candidates: buildTeacherCandidates(record, decisionKind, selectedCardId)
    };
    return output;
}

function parseArgs(argv) {
    const args = {
        input: '',
        out: '',
        includeNonHardcase: false,
        limit: 0,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === '--help' || token === '-h') { args.help = true; continue; }
        if (token === '--input') { args.input = String(argv[++i] || '').trim(); continue; }
        if (token === '--out') { args.out = String(argv[++i] || '').trim(); continue; }
        if (token === '--include-non-hardcase') { args.includeNonHardcase = true; continue; }
        if (token === '--limit') {
            const value = Number(argv[++i]);
            if (!Number.isFinite(value) || value < 0) throw new Error('--limit must be >= 0');
            args.limit = Math.floor(value);
            continue;
        }
        throw new Error(`unknown argument: ${token}`);
    }

    if (!args.help) {
        if (!args.input) throw new Error('--input is required');
        args.input = path.resolve(process.cwd(), args.input);
        args.out = args.out
            ? path.resolve(process.cwd(), args.out)
            : buildDefaultTeacherSolutionOutPath(args.input);
    }

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/export-teacher-solutions.js --input <hardcase.ndjson> [options]',
        '',
        'Options:',
        '      --input <path>             Input selfplay/hardcase NDJSON',
        '      --out <path>               Output teacher_solution.v1 NDJSON',
        '      --include-non-hardcase     Export all records, not only hardcases',
        '      --limit <n>                Stop after writing n records (default: 0=all)',
        '  -h, --help                     Show this help'
    ].join('\n'));
}

async function exportTeacherSolutions(args) {
    if (!args || !args.input || !args.out) {
        throw new Error('exportTeacherSolutions requires input/out paths');
    }
    if (!fs.existsSync(args.input)) {
        throw new Error(`input file not found: ${args.input}`);
    }

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    const reader = readline.createInterface({
        input: fs.createReadStream(args.input, { encoding: 'utf8' }),
        crlfDelay: Infinity
    });
    const writer = fs.createWriteStream(args.out, { encoding: 'utf8' });

    const summary = {
        schemaVersion: TEACHER_SOLUTION_SCHEMA_VERSION,
        method: TEACHER_SOLUTION_METHOD,
        inputPath: args.input,
        outPath: args.out,
        recordsRead: 0,
        recordsWritten: 0,
        parseErrors: 0,
        skippedNonHardcase: 0,
        byDecisionKind: {}
    };

    try {
        for await (const rawLine of reader) {
            const line = String(rawLine || '').trim();
            if (!line) continue;
            summary.recordsRead += 1;
            let record = null;
            try {
                record = JSON.parse(line);
            } catch (err) {
                summary.parseErrors += 1;
                continue;
            }
            if (!record || typeof record !== 'object') continue;
            if (!args.includeNonHardcase && !isHardcaseRecord(record)) {
                summary.skippedNonHardcase += 1;
                continue;
            }
            const teacherRecord = toTeacherSolutionRecord(record, {
                inputPath: args.input,
                lineNumber: summary.recordsRead
            });
            writer.write(`${JSON.stringify(teacherRecord)}\n`);
            summary.recordsWritten += 1;
            const decisionKind = teacherRecord.teacherSolution && teacherRecord.teacherSolution.decisionKind
                ? teacherRecord.teacherSolution.decisionKind
                : 'unknown';
            summary.byDecisionKind[decisionKind] = Number(summary.byDecisionKind[decisionKind] || 0) + 1;
            if (args.limit > 0 && summary.recordsWritten >= args.limit) break;
        }
    } finally {
        await new Promise((resolve, reject) => {
            writer.on('error', reject);
            writer.end(resolve);
        });
        reader.close();
    }

    return summary;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }
    const summary = await exportTeacherSolutions(args);
    console.log(`[teacher-solution] input=${summary.inputPath}`);
    console.log(`[teacher-solution] output=${summary.outPath}`);
    console.log(`[teacher-solution] recordsRead=${summary.recordsRead} recordsWritten=${summary.recordsWritten} parseErrors=${summary.parseErrors} skippedNonHardcase=${summary.skippedNonHardcase}`);
    console.log(`[teacher-solution] byDecisionKind=${JSON.stringify(summary.byDecisionKind)}`);
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[teacher-solution] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = {
    TEACHER_SOLUTION_SCHEMA_VERSION,
    TEACHER_SOLUTION_METHOD,
    buildDefaultTeacherSolutionOutPath,
    isHardcaseRecord,
    inferTeacherDecisionKind,
    toTeacherSolutionRecord,
    parseArgs,
    exportTeacherSolutions
};