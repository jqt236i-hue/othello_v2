#!/usr/bin/env node
'use strict';

// Suppress console logs from dependencies
const originalLog = console.log;
const originalError = console.error;
console.log = () => {};
console.error = () => {};

const { runSelfPlayGames } = require('./src/engine/selfplay-runner');
const Core = require('./game/logic/core');

// Restore for our own output
function output(...args) {
    originalLog(...args);
}

function error(...args) {
    originalError(...args);
}

const SETTINGS = {
    games: 20,
    baseSeed: 1,
    maxPlies: 220,
    allowCardUsage: true,
    cardUsageRate: 0.35
};

function isCornr(row, col, boardSize = 8) {
    const last = boardSize - 1;
    return (row === 0 || row === last) && (col === 0 || col === last);
}

function isEdge(row, col, boardSize = 8) {
    const last = boardSize - 1;
    return (row === 0 || row === last || col === 0 || col === last) && !isCornr(row, col, boardSize);
}

function getBoardSize(record) {
    if (record.boardString) {
        const parts = record.boardString.split('/');
        return parts.length || 8;
    }
    return 8;
}

function analyzeRecords(allRecords) {
    const missedCorners = [];
    const missedEdges = [];

    for (const record of allRecords) {
        if (!record || typeof record !== 'object') continue;

        // Check if this is a placement action (not a card action)
        const isPlacementAction = record.actionType === 'place' || 
                                  (record.row !== undefined && record.col !== undefined && 
                                   !record.useCardId && !record.destroyCardId);

        if (!isPlacementAction) continue;

        const boardSize = getBoardSize(record);
        const row = record.row;
        const col = record.col;

        // Skip invalid coordinates
        if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= boardSize || col >= boardSize) {
            continue;
        }

        // Case 1: hasCornerMoveNow is truthy but chosen action is NOT on corner
        if (record.hasCornerMoveNow && !isCornr(row, col, boardSize)) {
            missedCorners.push({
                seed: record.seed,
                ply: record.ply,
                player: record.player,
                actionType: record.actionType,
                row,
                col,
                useCardId: record.useCardId,
                destroyCardId: record.destroyCardId,
                future: record.futureDiscDelta3Ply !== undefined ? record.futureDiscDelta3Ply : 0,
                handCards: record.handCards,
                decisionCandidates: record.decisionCandidates
            });
        }

        // Case 2: hasEdgeMoveNow is truthy AND hasCornerMoveNow is falsy, but action is NOT on edge
        if (record.hasEdgeMoveNow && !record.hasCornerMoveNow && !isEdge(row, col, boardSize) && !isCornr(row, col, boardSize)) {
            missedEdges.push({
                seed: record.seed,
                ply: record.ply,
                player: record.player,
                actionType: record.actionType,
                row,
                col,
                useCardId: record.useCardId,
                destroyCardId: record.destroyCardId,
                future: record.futureDiscDelta3Ply !== undefined ? record.futureDiscDelta3Ply : 0,
                handCards: record.handCards,
                decisionCandidates: record.decisionCandidates
            });
        }
    }

    // Sort by future asc
    missedCorners.sort((a, b) => (a.future || 0) - (b.future || 0));
    missedEdges.sort((a, b) => (a.future || 0) - (b.future || 0));

    return {
        missedCornerCount: missedCorners.length,
        missedEdgeCount: missedEdges.length,
        worstMissedCorners: missedCorners.slice(0, 5),
        worstMissedEdges: missedEdges.slice(0, 5)
    };
}

async function main() {
    error('Running selfplay with settings:', SETTINGS);
    
    try {
        const allRecords = [];
        
        const onRecord = (record) => {
            if (record && typeof record === 'object') {
                allRecords.push(record);
            }
        };

        const result = runSelfPlayGames({
            ...SETTINGS,
            onRecord
        });

        error(`Collected ${result.records ? result.records.length : allRecords.length} records`);
        
        const records = result.records && result.records.length > 0 ? result.records : allRecords;
        const analysis = analyzeRecords(records);
        output(JSON.stringify(analysis, null, 2));
    } catch (err) {
        error('Error:', err);
        process.exit(1);
    }
}

main();
