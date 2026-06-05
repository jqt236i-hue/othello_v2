"use strict";

const Board = require("../core/board");

function validatePolicyModel(model) {
  return !!model && typeof model === "object" && model.schemaVersion === "policy_table.v2";
}

function normalizeEngineConfig(config) {
  return config && typeof config === "object" ? config : {};
}

function encodeBoard(board) {
  return (board || [])
    .map((row) =>
      (row || [])
        .map((cell) => {
          if (cell === Board.BLACK) return "B";
          if (cell === Board.WHITE) return "W";
          return ".";
        })
        .join("")
    )
    .join("/");
}

function transformCoord(row, col, transformId) {
  if (transformId === 1) return [col, 7 - row];
  if (transformId === 2) return [7 - row, 7 - col];
  if (transformId === 3) return [7 - col, row];
  if (transformId === 4) return [row, 7 - col];
  if (transformId === 5) return [7 - col, 7 - row];
  if (transformId === 6) return [7 - row, col];
  if (transformId === 7) return [col, row];
  return [row, col];
}

function transformBoard(rows, transformId) {
  const out = Array.from({ length: 8 }, () => Array(8).fill("."));
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const [r, c] = transformCoord(row, col, transformId);
      out[r][c] = rows[row][col];
    }
  }
  return out.map((row) => row.join("")).join("/");
}

function canonicalize(boardKey) {
  const rows = String(boardKey || "").split("/");
  if (rows.length !== 8 || rows.some((row) => row.length !== 8)) return { key: boardKey, transformId: 0 };
  let bestKey = "";
  let bestTransform = 0;
  for (let i = 0; i < 8; i += 1) {
    const key = transformBoard(rows, i);
    if (!bestKey || key < bestKey) {
      bestKey = key;
      bestTransform = i;
    }
  }
  return { key: bestKey, transformId: bestTransform };
}

function inverseTransformCoord(row, col, transformId) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const mapped = transformCoord(r, c, transformId);
      if (mapped[0] === row && mapped[1] === col) return { row: r, col: c };
    }
  }
  return { row, col };
}

function parseAction(action) {
  const parts = String(action || "").split(":");
  if (parts.length !== 3 || parts[0] !== "place") return null;
  const row = Number(parts[1]);
  const col = Number(parts[2]);
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 7 || col < 0 || col > 7) return null;
  return { row, col };
}

function resolveTableMove(legalMoves, board, playerKey, policyModel) {
  if (!validatePolicyModel(policyModel)) return null;
  const legalMovesCount = Array.isArray(legalMoves) ? legalMoves.length : 0;
  const boardKey = encodeBoard(board);
  const canonical = canonicalize(boardKey);
  const stateKey = `${playerKey}|${canonical.key}|-|${legalMovesCount}`;
  const state = policyModel.states && policyModel.states[stateKey];
  const action = parseAction(state && state.bestAction);
  if (!action) return null;
  const original = inverseTransformCoord(action.row, action.col, canonical.transformId);
  return legalMoves.find((move) => Number(move.row) === original.row && Number(move.col) === original.col) || null;
}

function isCorner(move) {
  return !!move && (move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7);
}

function isEdge(move) {
  return !!move && !isCorner(move) && (move.row === 0 || move.row === 7 || move.col === 0 || move.col === 7);
}

function isXSquare(move) {
  return !!move && (move.row === 1 || move.row === 6) && (move.col === 1 || move.col === 6);
}

function chooseHeuristicMove(legalMoves, context) {
  const board = context && context.board;
  const player = Board.keyToPlayer(context && context.playerKey);
  let best = null;
  let bestScore = -Infinity;
  for (const move of legalMoves || []) {
    const next = Board.applyMove(board, move, player);
    const opponent = Board.oppositePlayer(player);
    const ownLegal = Board.getLegalMoves(next, player).length;
    const oppLegal = Board.getLegalMoves(next, opponent).length;
    const discs = Board.countDiscs(next);
    const discDiff = player === Board.BLACK ? discs.black - discs.white : discs.white - discs.black;
    let score = 0;
    if (isCorner(move)) score += 1000;
    else if (isEdge(move)) score += 80;
    if (isXSquare(move)) score -= 220;
    score += (Array.isArray(move.flips) ? move.flips.length : 0) * 4;
    score += (ownLegal - oppLegal) * 18;
    score += discDiff * 1.5;
    if (score > bestScore || (score === bestScore && best && move.row * 8 + move.col < best.row * 8 + best.col)) {
      best = move;
      bestScore = score;
    }
  }
  return best || (legalMoves && legalMoves[0]) || null;
}

function chooseEngineMove(legalMoves, context, models) {
  const tableMove = resolveTableMove(
    legalMoves,
    context && context.board,
    context && context.playerKey,
    models && models.policyModel
  );
  return tableMove || chooseHeuristicMove(legalMoves, context);
}

module.exports = {
  validatePolicyModel,
  normalizeEngineConfig,
  chooseEngineMove
};
