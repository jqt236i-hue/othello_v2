// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;

'use strict';

const fs = require('fs');
const path = require('path');
const TurnPipeline = require('../game/turn/turn_pipeline');
const Core = require('../game/logic/core');
const CardLogic = require('../game/logic/cards');
const { getSafeCardContext } = require('../game/logic/context');

function parseArgs(argv) {
    const args = {
        input: null,
        index: 0,
        all: false,
        help: false
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--input' || a === '-i') { args.input = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--index') { args.index = Number(argv[++i]); continue; }
        if (a === '--all') { args.all = true; continue; }
    }
    if (args.help) return args;
    if (!args.input) throw new Error('--input is required');
    if (!Number.isFinite(args.index) || args.index < 0) throw new Error('--index must be >= 0');
    args.index = Math.floor(args.index);
    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/replay-selfplay-illegal-move-hardcase.js --input <illegal-move.ndjson> [options]',
        '',
        'Options:',
        '  -i, --input <path>  Input selfplay illegal-move hardcase NDJSON',
        '      --index <n>     Replay one record by zero-based index (default: 0)',
        '      --all           Replay all records',
        '  -h, --help          Show this help'
    ].join('\n'));
}

function readHardcases(inputPath) {
    const raw = fs.readFileSync(inputPath, 'utf8');
    return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
            try {
                return JSON.parse(line);
            } catch (err) {
                throw new Error(`invalid JSON at line ${index + 1}: ${err && err.message ? err.message : err}`);
            }
        });
}

function replayOne(record) {
    if (!record || record.schemaVersion !== 'selfplay_illegal_move_hardcase.v1') {
        throw new Error('unsupported hardcase schema');
    }
    const snapshot = record.snapshot || {};
    const gameState = snapshot.gameState;
    const cardState = snapshot.cardState;
    const action = record.forcedAction || record.lastPlacementAction;
    if (!gameState || !cardState || !action) {
        throw new Error('hardcase is missing snapshot/action');
    }

    const pendingType = CardLogic.getPendingEffectType(cardState, record.player) || null;
    const freePlacement = CardLogic.isFreePlacementPendingType(pendingType);
    const flipsBefore = action.type === 'place' && !freePlacement
        ? Core.getFlipsWithContext(gameState, action.row, action.col, record.player === 'black' ? Core.BLACK : Core.WHITE, getSafeCardContext(cardState)).length
        : null;
    const result = TurnPipeline.applyTurnSafe(
        cardState,
        gameState,
        record.player,
        action,
        null,
        {
            currentStateVersion: Number(record.stateVersion) || 0,
            skipTurnStart: snapshot.turnStartApplied === true
        }
    );
    return {
        gameIndex: record.gameIndex,
        ply: record.ply,
        player: record.player,
        action,
        pendingType,
        flipsBefore,
        ok: !!(result && result.ok),
        rejectedReason: result && result.rejectedReason ? result.rejectedReason : null,
        errorMessage: result && result.errorMessage ? result.errorMessage : null
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }
    const records = readHardcases(args.input);
    const selected = args.all ? records : [records[args.index]];
    if (selected.some((one) => !one)) throw new Error(`record index not found: ${args.index}`);
    const results = selected.map(replayOne);
    const failures = results.filter((one) => !one.ok).length;
    console.log(JSON.stringify({
        schemaVersion: 'selfplay_illegal_move_replay.v1',
        input: args.input,
        records: results.length,
        failures,
        results
    }, null, 2));
    if (failures > 0) process.exitCode = 2;
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[illegal-move-replay] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

export = {
    parseArgs,
    readHardcases,
    replayOne
};
