#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

const Board = require("../othello-ai/core/board");
const Engine = require("../othello-ai/runtime/engine");
const ValueTable = require("../othello-ai/eval/value-table");
const OthelloOnnxRuntime = require("../game/ai/othello-onnx-runtime");

function loadFreshOthelloOnnxRuntime() {
  const runtimePath = require.resolve("../game/ai/othello-onnx-runtime");
  delete require.cache[runtimePath];
  return require(runtimePath);
}

function parseIntArg(value: any, fallback: any, min: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

function createRng(seed: any) {
  let state = (seed >>> 0) || 1;
  return {
    next() {
      state = ((state * 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    }
  };
}

function parseArgs(argv: any) {
  const args = {
    onnxModel: "data/models/othello/policy-value.onnx",
    onnxMeta: "data/models/othello/policy-value.onnx.meta.json",
    tablePolicy: "othello-ai/data/models/policy-table.champion.json",
    tableValue: "othello-ai/data/models/value-table.champion.json",
    baselineOnnxModel: "othello-ai/data/models/policy-value.onnx.champion.onnx",
    baselineOnnxMeta: "othello-ai/data/models/policy-value.onnx.champion.onnx.meta.json",
    baseline: "table",
    dataset: "",
    sampleLimit: 0,
    pairs: 2,
    openingPlies: 4,
    seed: 20260523,
    depthOpening: 2,
    depthMid: 3,
    depthEnd: 4,
    exactSolveEmpties: 10,
    onnxValueRerank: true,
    onnxFullSearchRerank: false,
    onnxPolicyBlendWeight: 0,
    heuristicRerankWeight: 3.0,
    policyWeight: 0.75,
    topK: 8,
    whiteSafetyMultiplier: 1.45,
    out: "othello-ai/data/onnx/onnx-vs-table.eval.json",
    verbose: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const cur = argv[i];
    if (cur === "--onnx-model") args.onnxModel = argv[++i] || args.onnxModel;
    else if (cur === "--onnx-meta") args.onnxMeta = argv[++i] || args.onnxMeta;
    else if (cur === "--table-policy") args.tablePolicy = argv[++i] || args.tablePolicy;
    else if (cur === "--table-value") args.tableValue = argv[++i] || args.tableValue;
    else if (cur === "--baseline-onnx-model") args.baselineOnnxModel = argv[++i] || args.baselineOnnxModel;
    else if (cur === "--baseline-onnx-meta") args.baselineOnnxMeta = argv[++i] || args.baselineOnnxMeta;
    else if (cur === "--baseline") args.baseline = String(argv[++i] || args.baseline).toLowerCase();
    else if (cur === "--dataset") args.dataset = argv[++i] || args.dataset;
    else if (cur === "--sample-limit") args.sampleLimit = parseIntArg(argv[++i], args.sampleLimit, 0);
    else if (cur === "--pairs") args.pairs = parseIntArg(argv[++i], args.pairs, 1);
    else if (cur === "--opening-plies") args.openingPlies = parseIntArg(argv[++i], args.openingPlies, 0);
    else if (cur === "--seed") args.seed = parseIntArg(argv[++i], args.seed, 0);
    else if (cur === "--depth-opening") args.depthOpening = parseIntArg(argv[++i], args.depthOpening, 1);
    else if (cur === "--depth-mid") args.depthMid = parseIntArg(argv[++i], args.depthMid, 1);
    else if (cur === "--depth-end") args.depthEnd = parseIntArg(argv[++i], args.depthEnd, 1);
    else if (cur === "--exact-solve-empties") args.exactSolveEmpties = parseIntArg(argv[++i], args.exactSolveEmpties, 0);
    else if (cur === "--onnx-value-rerank") args.onnxValueRerank = true;
    else if (cur === "--no-onnx-value-rerank") args.onnxValueRerank = false;
    else if (cur === "--onnx-full-search-rerank") args.onnxFullSearchRerank = true;
    else if (cur === "--no-onnx-full-search-rerank") args.onnxFullSearchRerank = false;
    else if (cur === "--onnx-policy-blend-weight") args.onnxPolicyBlendWeight = Number(argv[++i]) || 0;
    else if (cur === "--heuristic-rerank-weight") args.heuristicRerankWeight = Number(argv[++i]);
    else if (cur === "--policy-weight") args.policyWeight = Number(argv[++i]);
    else if (cur === "--top-k") args.topK = parseIntArg(argv[++i], args.topK, 1);
    else if (cur === "--white-safety-multiplier") args.whiteSafetyMultiplier = Number(argv[++i]);
    else if (cur === "--out") args.out = argv[++i] || args.out;
    else if (cur === "--verbose") args.verbose = true;
    else if (cur === "--help" || cur === "-h") {
      console.log([
        "Usage: node scripts/evaluate-othello-onnx.js [options]",
        "  --onnx-model <path>",
        "  --onnx-meta <path>",
        "  --table-policy <path>",
        "  --table-value <path>",
        "  --baseline-onnx-model <path>",
        "  --baseline-onnx-meta <path>",
        "  --baseline <table|heuristic|onnx>",
        "  --dataset <teacher.jsonl>      Run sample agreement/value evaluation instead of full games",
        "  --sample-limit <n>",
        "  --pairs <n>",
        "  --opening-plies <n>",
        "  --seed <n>",
        "  --depth-opening <n>",
        "  --depth-mid <n>",
        "  --depth-end <n>",
        "  --exact-solve-empties <n>",
        "  --onnx-value-rerank        Pick by ONNX value after candidate move",
        "  --no-onnx-value-rerank",
        "  --onnx-full-search-rerank  Use the legacy exhaustive value-only gate path instead of runtime.chooseMove",
        "  --no-onnx-full-search-rerank",
        "  --onnx-policy-blend-weight <n>",
        "  --heuristic-rerank-weight <n>",
        "  --policy-weight <n>",
        "  --top-k <n>",
        "  --white-safety-multiplier <n>",
        "  --out <path>",
        "  --verbose"
      ].join("\n"));
      process.exit(0);
    }
  }
  return args;
}

function loadJson(filePath: any) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertReadable(filePath: any, label: any) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} not found: ${filePath}`);
}

function fileSize(filePath: any) {
  return fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
}

function resolveMove(candidates: any, move: any) {
  if (!move) return null;
  for (const one of candidates) {
    if (Number(one.row) === Number(move.row) && Number(one.col) === Number(move.col)) return one;
  }
  return null;
}

function cloneState(state: any) {
  return {
    board: Board.cloneBoard(state.board),
    currentPlayer: state.currentPlayer,
    passCount: state.passCount,
    ply: state.ply
  };
}

function applyRandomOpening(plies: any, rng: any) {
  let state = {
    board: Board.createInitialBoard(),
    currentPlayer: Board.BLACK,
    passCount: 0,
    ply: 0
  };
  let applied = 0;
  while (applied < plies && state.passCount < 2) {
    const legalMoves = Board.getLegalMoves(state.board, state.currentPlayer);
    if (legalMoves.length <= 0) {
      state = {
        board: state.board,
        currentPlayer: Board.oppositePlayer(state.currentPlayer),
        passCount: state.passCount + 1,
        ply: state.ply
      };
      continue;
    }
    const index = Math.max(0, Math.min(legalMoves.length - 1, Math.floor(rng.next() * legalMoves.length)));
    state = {
      board: Board.applyMove(state.board, legalMoves[index], state.currentPlayer),
      currentPlayer: Board.oppositePlayer(state.currentPlayer),
      passCount: 0,
      ply: state.ply + 1
    };
    applied += 1;
  }
  return { state, applied };
}

function createStats() {
  return { calls: 0, totalMs: 0, maxMs: 0 };
}

function recordStats(stats: any, startedAt: any) {
  const ms = Math.max(0, performance.now() - startedAt);
  stats.calls += 1;
  stats.totalMs += ms;
  stats.maxMs = Math.max(stats.maxMs, ms);
}

async function chooseOnnxMoveWithValueRerank(agent: any, state: any, legalMoves: any, playerKey: any) {
  const runtime = agent.runtime || OthelloOnnxRuntime;
  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const move of legalMoves) {
    const nextBoard = Board.applyMove(state.board, move, state.currentPlayer);
    const nextPlayer = Board.oppositePlayer(state.currentPlayer);
    const nextLegalMoves = Board.getLegalMoves(nextBoard, nextPlayer);
    const valueForOpponent = await runtime.evaluatePosition({
      board: nextBoard,
      playerKey: Board.playerToKey(nextPlayer),
      level: 6,
      legalMovesCount: nextLegalMoves.length
    });
    const currentValue = Number.isFinite(Number(valueForOpponent)) ? -Number(valueForOpponent) : 0;
    let score = currentValue;
    if (agent.policyBlendWeight > 0) {
      const policyMove = await runtime.chooseMove(legalMoves, {
        board: state.board,
        playerKey,
        level: 6,
        legalMovesCount: legalMoves.length
      });
      if (moveIndex(policyMove) === moveIndex(move)) score += agent.policyBlendWeight;
    }
    if (score > bestScore || (score === bestScore && best && moveIndex(move) < moveIndex(best))) {
      best = move;
      bestScore = score;
    }
  }
  return best;
}

function isCorner(move: any) {
  return !!move && (move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7);
}

function isEdge(move: any) {
  return !!move && !isCorner(move) && (move.row === 0 || move.row === 7 || move.col === 0 || move.col === 7);
}

function isXSquare(move: any) {
  return !!move && (move.row === 1 || move.row === 6) && (move.col === 1 || move.col === 6);
}

function chooseHeuristicMove(state: any, legalMoves: any) {
  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  const player = state.currentPlayer;
  for (const move of legalMoves) {
    const nextBoard = Board.applyMove(state.board, move, player);
    const opponent = Board.oppositePlayer(player);
    const ownLegal = Board.getLegalMoves(nextBoard, player).length;
    const opponentLegal = Board.getLegalMoves(nextBoard, opponent).length;
    const discs = Board.countDiscs(nextBoard);
    const discDiff = player === Board.BLACK ? discs.black - discs.white : discs.white - discs.black;
    let score = 0;
    if (isCorner(move)) score += 1000;
    if (isEdge(move)) score += 90;
    if (isXSquare(move)) score -= 220;
    score += (Array.isArray(move.flips) ? move.flips.length : 0) * 4;
    score += (ownLegal - opponentLegal) * 18;
    score += discDiff * 1.5;
    if (score > bestScore || (score === bestScore && best && moveIndex(move) < moveIndex(best))) {
      best = move;
      bestScore = score;
    }
  }
  return best || legalMoves[0] || null;
}

async function chooseMove(agent: any, state: any, legalMoves: any) {
  const playerKey = Board.playerToKey(state.currentPlayer);
  const startedAt = performance.now();
  let selected = null;
  if (agent.kind === "onnx") {
    const runtime = agent.runtime || OthelloOnnxRuntime;
    if (agent.fullSearchRerank) {
      selected = await chooseOnnxMoveWithValueRerank(agent, state, legalMoves, playerKey);
    } else {
      selected = await runtime.chooseMove(legalMoves, {
        board: state.board,
        playerKey,
        level: 6,
        legalMovesCount: legalMoves.length
      });
    }
  } else if (agent.kind === "table") {
    selected = Engine.chooseEngineMove(legalMoves, {
      board: state.board,
      playerKey,
      level: 6
    }, agent.models, agent.config);
  } else {
    selected = chooseHeuristicMove(state, legalMoves);
  }
  recordStats(agent.stats, startedAt);
  const resolved = resolveMove(legalMoves, selected);
  if (!resolved) throw new Error(`${agent.label} selected illegal/null move at ply ${state.ply}`);
  return resolved;
}

async function playGame(pairIndex: any, gameIndex: any, opening: any, openingApplied: any, blackAgent: any, whiteAgent: any) {
  let state = cloneState(opening);
  while (state.passCount < 2) {
    const legalMoves = Board.getLegalMoves(state.board, state.currentPlayer);
    if (legalMoves.length <= 0) {
      state = {
        board: state.board,
        currentPlayer: Board.oppositePlayer(state.currentPlayer),
        passCount: state.passCount + 1,
        ply: state.ply
      };
      continue;
    }
    const active = state.currentPlayer === Board.BLACK ? blackAgent : whiteAgent;
    const move = await chooseMove(active, state, legalMoves);
    state = {
      board: Board.applyMove(state.board, move, state.currentPlayer),
      currentPlayer: Board.oppositePlayer(state.currentPlayer),
      passCount: 0,
      ply: state.ply + 1
    };
  }
  const discs = Board.countDiscs(state.board);
  let winner = "draw";
  if (discs.black > discs.white) winner = blackAgent.id;
  else if (discs.white > discs.black) winner = whiteAgent.id;
  const discDiffFromOnnx = blackAgent.id === "onnx"
    ? discs.black - discs.white
    : discs.white - discs.black;
  return {
    pairIndex,
    gameIndex,
    blackAgentId: blackAgent.id,
    whiteAgentId: whiteAgent.id,
    openingPliesApplied: openingApplied,
    winner,
    blackDiscs: discs.black,
    whiteDiscs: discs.white,
    discDiffFromOnnx,
    totalPlies: state.ply
  };
}

function summarizeGames(games: any) {
  let onnxWins = 0;
  let baselineWins = 0;
  let draws = 0;
  let diffTotal = 0;
  let onnxWhiteGames = 0;
  let onnxWhiteWins = 0;
  let onnxWhiteDraws = 0;
  let onnxWhiteDiffTotal = 0;
  for (const game of games) {
    diffTotal += game.discDiffFromOnnx;
    if (game.winner === "onnx") onnxWins += 1;
    else if (game.winner === "baseline") baselineWins += 1;
    else draws += 1;
    if (game.whiteAgentId === "onnx") {
      onnxWhiteGames += 1;
      onnxWhiteDiffTotal += game.discDiffFromOnnx;
      if (game.winner === "onnx") onnxWhiteWins += 1;
      else if (game.winner === "draw") onnxWhiteDraws += 1;
    }
  }
  const onnxPoints = onnxWins + draws * 0.5;
  const baselinePoints = baselineWins + draws * 0.5;
  const onnxWhitePoints = onnxWhiteWins + onnxWhiteDraws * 0.5;
  return {
    games: games.length,
    onnxWins,
    baselineWins,
    draws,
    onnxPoints,
    baselinePoints,
    onnxPointRate: games.length > 0 ? onnxPoints / games.length : 0,
    averageDiscDiffFromOnnx: games.length > 0 ? diffTotal / games.length : 0,
    onnxWhiteGames,
    onnxWhiteWins,
    onnxWhiteDraws,
    onnxWhitePointRate: onnxWhiteGames > 0 ? onnxWhitePoints / onnxWhiteGames : 0,
    averageWhiteDiscDiffFromOnnx: onnxWhiteGames > 0 ? onnxWhiteDiffTotal / onnxWhiteGames : 0
  };
}

function formatStats(stats: any) {
  return {
    calls: stats.calls,
    totalMs: stats.totalMs,
    averageMs: stats.calls > 0 ? stats.totalMs / stats.calls : 0,
    maxMs: stats.maxMs
  };
}

function boardFromTeacherText(raw: any) {
  const rows = String(raw || "").trim().split("/");
  if (rows.length !== 8) return null;
  const board = rows.map((row) => row.split("").map((ch) => {
    if (ch === "B") return Board.BLACK;
    if (ch === "W") return Board.WHITE;
    return Board.EMPTY;
  }));
  return board.every((row) => row.length === 8) ? board : null;
}

function moveIndex(move: any) {
  if (!move) return -1;
  const row = Number(move.row);
  const col = Number(move.col);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return -1;
  return row * 8 + col;
}

async function runDatasetEvaluation(args: any, onnxModel: any, onnxMeta: any) {
  const datasetPath = path.resolve(process.cwd(), args.dataset);
  assertReadable(datasetPath, "teacher dataset");
  const ok = await OthelloOnnxRuntime.loadFromUrl(onnxModel, onnxMeta);
  if (!ok) throw new Error(`failed to load ONNX: ${JSON.stringify(OthelloOnnxRuntime.getStatus())}`);
  OthelloOnnxRuntime.configure({
    useValueRerank: args.onnxValueRerank,
    heuristicRerankWeight: args.heuristicRerankWeight,
    policyWeight: args.policyWeight,
    topK: args.topK,
    whiteSafetyMultiplier: args.whiteSafetyMultiplier,
    exactSolveEmpties: args.exactSolveEmpties
  });

  const stats = createStats();
  let read = 0;
  let used = 0;
  let skipped = 0;
  let matched = 0;
  let valueAbsErrorTotal = 0;
  const sourceCounts = Object.create(null);
  const lines = fs.readFileSync(datasetPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    if (args.sampleLimit > 0 && used >= args.sampleLimit) break;
    read += 1;
    let rec = null;
    try {
      rec = JSON.parse(line);
    } catch (e) {
      skipped += 1;
      continue;
    }
    const board = boardFromTeacherText(rec.board);
    const player = Board.keyToPlayer(rec.player);
    const legalMoves = board ? Board.getLegalMoves(board, player) : [];
    const target = Number(rec.policyTarget);
    if (!board || legalMoves.length <= 0 || !Number.isInteger(target)) {
      skipped += 1;
      continue;
    }
    const startedAt = performance.now();
    const selected = await OthelloOnnxRuntime.chooseMove(legalMoves, {
      board,
      playerKey: Board.playerToKey(player),
      level: 6,
      legalMovesCount: legalMoves.length
    });
    const value = await OthelloOnnxRuntime.evaluatePosition({
      board,
      playerKey: Board.playerToKey(player),
      level: 6,
      legalMovesCount: legalMoves.length
    });
    recordStats(stats, startedAt);
    if (moveIndex(selected) === target) matched += 1;
    if (Number.isFinite(Number(value)) && Number.isFinite(Number(rec.valueTarget))) {
      valueAbsErrorTotal += Math.abs(Number(value) - Number(rec.valueTarget));
    }
    const source = String(rec.policySource || "unknown");
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    used += 1;
  }

  const summary: any = {
    schemaVersion: "othello_onnx_dataset_eval.v1",
    createdAt: new Date().toISOString(),
    config: {
      dataset: datasetPath,
      sampleLimit: args.sampleLimit,
      seed: args.seed
    },
    artifacts: {
      onnxModel,
      onnxMeta,
      sizes: {
        onnxModelBytes: fileSize(onnxModel),
        onnxMetaBytes: fileSize(onnxMeta),
        onnxTotalBytes: fileSize(onnxModel) + fileSize(onnxMeta)
      }
    },
    onnxStatus: OthelloOnnxRuntime.getStatus(),
    totals: {
      recordsRead: read,
      recordsUsed: used,
      recordsSkipped: skipped,
      matched,
      teacherMatchRate: used > 0 ? matched / used : 0,
      valueMeanAbsError: used > 0 ? valueAbsErrorTotal / used : 0,
      policySourceCounts: sourceCounts
    },
    inference: {
      onnx: formatStats(stats)
    }
  };
  if (args.out) {
    const outPath = path.resolve(process.cwd(), args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");
    summary.outPath = outPath;
  }
  console.log([
    `recordsUsed: ${summary.totals.recordsUsed}`,
    `teacherMatchRate: ${summary.totals.teacherMatchRate.toFixed(4)}`,
    `valueMae: ${summary.totals.valueMeanAbsError.toFixed(4)}`,
    `onnxAvgMs: ${summary.inference.onnx.averageMs.toFixed(3)}`,
    `onnxSizeKiB: ${(summary.artifacts.sizes.onnxTotalBytes / 1024).toFixed(1)}`,
    `out: ${summary.outPath || ""}`
  ].join("\n"));
}

async function main(argv: any = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const onnxModel = path.resolve(process.cwd(), args.onnxModel);
  const onnxMeta = path.resolve(process.cwd(), args.onnxMeta);
  const tablePolicy = path.resolve(process.cwd(), args.tablePolicy);
  const tableValue = path.resolve(process.cwd(), args.tableValue);
  const baselineOnnxModel = path.resolve(process.cwd(), args.baselineOnnxModel);
  const baselineOnnxMeta = path.resolve(process.cwd(), args.baselineOnnxMeta);
  assertReadable(onnxModel, "ONNX model");
  assertReadable(onnxMeta, "ONNX meta");
  if (args.dataset) {
    await runDatasetEvaluation(args, onnxModel, onnxMeta);
    return;
  }
  let policyModel = null;
  let valueModel = null;
  let baselineRuntime = null;
  if (args.baseline === "table") {
    assertReadable(tablePolicy, "table policy");
    assertReadable(tableValue, "table value");
    policyModel = loadJson(tablePolicy);
    valueModel = loadJson(tableValue);
    if (!Engine.validatePolicyModel(policyModel)) throw new Error(`invalid table policy: ${tablePolicy}`);
    if (!ValueTable.isValueTableModel(valueModel)) throw new Error(`invalid table value: ${tableValue}`);
  } else if (args.baseline === "onnx") {
    assertReadable(baselineOnnxModel, "baseline ONNX model");
    assertReadable(baselineOnnxMeta, "baseline ONNX meta");
  } else if (args.baseline !== "heuristic") {
    throw new Error(`unknown baseline: ${args.baseline}`);
  }

  const candidateRuntime = loadFreshOthelloOnnxRuntime();
  const ok = await candidateRuntime.loadFromUrl(onnxModel, onnxMeta);
  if (!ok) throw new Error(`failed to load ONNX: ${JSON.stringify(candidateRuntime.getStatus())}`);
  candidateRuntime.configure({
    useValueRerank: args.onnxValueRerank,
    heuristicRerankWeight: args.heuristicRerankWeight,
    policyWeight: args.policyWeight,
    topK: args.topK,
    whiteSafetyMultiplier: args.whiteSafetyMultiplier,
    exactSolveEmpties: args.exactSolveEmpties
  });
  if (args.baseline === "onnx") {
    baselineRuntime = loadFreshOthelloOnnxRuntime();
    const baselineOk = await baselineRuntime.loadFromUrl(baselineOnnxModel, baselineOnnxMeta);
    if (!baselineOk) throw new Error(`failed to load baseline ONNX: ${JSON.stringify(baselineRuntime.getStatus())}`);
    baselineRuntime.configure({
      useValueRerank: args.onnxValueRerank,
      heuristicRerankWeight: args.heuristicRerankWeight,
      policyWeight: args.policyWeight,
      topK: args.topK,
      whiteSafetyMultiplier: args.whiteSafetyMultiplier,
      exactSolveEmpties: args.exactSolveEmpties
    });
  }

  const config = Engine.normalizeEngineConfig({
    teacherOptions: {
      depthOpening: args.depthOpening,
      depthMid: args.depthMid,
      depthEnd: args.depthEnd,
      exactSolveEmpties: args.exactSolveEmpties
    }
  });
  const onnxAgent = {
    id: "onnx",
    label: args.onnxFullSearchRerank ? "onnxFullSearchRerank" : (args.onnxValueRerank ? "onnxRuntimeValueRerank" : "onnxRuntime"),
    kind: "onnx",
    stats: createStats(),
    valueRerank: args.onnxValueRerank,
    fullSearchRerank: args.onnxFullSearchRerank,
    policyBlendWeight: args.onnxPolicyBlendWeight,
    runtime: candidateRuntime
  };
  const tableAgent = {
    id: "baseline",
    label: args.baseline === "heuristic" ? "fixedHeuristic" : args.baseline === "onnx" ? "onnxChampion" : "tableChampion",
    kind: args.baseline === "heuristic" ? "heuristic" : args.baseline === "onnx" ? "onnx" : "table",
    stats: createStats(),
    models: { policyModel, valueModel },
    config,
    valueRerank: args.onnxValueRerank,
    fullSearchRerank: args.onnxFullSearchRerank,
    policyBlendWeight: args.onnxPolicyBlendWeight,
    runtime: baselineRuntime
  };
  const games = [];
  for (let pairIndex = 0; pairIndex < args.pairs; pairIndex += 1) {
    const opening = applyRandomOpening(args.openingPlies, createRng(args.seed + pairIndex));
    games.push(await playGame(pairIndex + 1, games.length + 1, opening.state, opening.applied, onnxAgent, tableAgent));
    games.push(await playGame(pairIndex + 1, games.length + 1, opening.state, opening.applied, tableAgent, onnxAgent));
    if (args.verbose) {
      const last = games.slice(-2);
      console.log(`[pair ${pairIndex + 1}] ${last.map((g) => `${g.blackAgentId}:${g.blackDiscs}-${g.whiteDiscs}:${g.winner}`).join(" | ")}`);
    }
  }

  const summary: any = {
    schemaVersion: "othello_onnx_vs_table_eval.v1",
    createdAt: new Date().toISOString(),
    config: {
      pairs: args.pairs,
      openingPlies: args.openingPlies,
      seed: args.seed,
      depthOpening: args.depthOpening,
      depthMid: args.depthMid,
      depthEnd: args.depthEnd,
      exactSolveEmpties: args.exactSolveEmpties
      ,
      baseline: args.baseline,
      onnxValueRerank: args.onnxValueRerank,
      onnxFullSearchRerank: args.onnxFullSearchRerank,
      onnxPolicyBlendWeight: args.onnxPolicyBlendWeight,
      heuristicRerankWeight: args.heuristicRerankWeight,
      policyWeight: args.policyWeight,
      topK: args.topK,
      whiteSafetyMultiplier: args.whiteSafetyMultiplier
    },
    artifacts: {
      onnxModel,
      onnxMeta,
      tablePolicy,
      tableValue,
      baselineOnnxModel,
      baselineOnnxMeta,
      sizes: {
        onnxModelBytes: fileSize(onnxModel),
        onnxMetaBytes: fileSize(onnxMeta),
        tablePolicyBytes: fileSize(tablePolicy),
        tableValueBytes: fileSize(tableValue),
        baselineOnnxModelBytes: fileSize(baselineOnnxModel),
        baselineOnnxMetaBytes: fileSize(baselineOnnxMeta),
        onnxTotalBytes: fileSize(onnxModel) + fileSize(onnxMeta),
        tableTotalBytes: fileSize(tablePolicy) + fileSize(tableValue),
        baselineOnnxTotalBytes: fileSize(baselineOnnxModel) + fileSize(baselineOnnxMeta)
      }
    },
    onnxStatus: candidateRuntime.getStatus(),
    baselineOnnxStatus: baselineRuntime ? baselineRuntime.getStatus() : null,
    totals: summarizeGames(games),
    inference: {
      onnx: formatStats(onnxAgent.stats),
      baseline: formatStats(tableAgent.stats)
    },
    games
  };

  if (args.out) {
    const outPath = path.resolve(process.cwd(), args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");
    summary.outPath = outPath;
  }

  console.log([
    `games: ${summary.totals.games}`,
    `onnxWins: ${summary.totals.onnxWins}`,
    `baselineWins: ${summary.totals.baselineWins}`,
    `draws: ${summary.totals.draws}`,
    `onnxPointRate: ${summary.totals.onnxPointRate.toFixed(4)}`,
    `onnxWhitePointRate: ${summary.totals.onnxWhitePointRate.toFixed(4)}`,
    `avgWhiteDiscDiffFromOnnx: ${summary.totals.averageWhiteDiscDiffFromOnnx.toFixed(2)}`,
    `avgDiscDiffFromOnnx: ${summary.totals.averageDiscDiffFromOnnx.toFixed(2)}`,
    `onnxAvgMs: ${summary.inference.onnx.averageMs.toFixed(3)}`,
    `baselineAvgMs: ${summary.inference.baseline.averageMs.toFixed(3)}`,
    `onnxSizeKiB: ${(summary.artifacts.sizes.onnxTotalBytes / 1024).toFixed(1)}`,
    `tableSizeMiB: ${(summary.artifacts.sizes.tableTotalBytes / (1024 * 1024)).toFixed(1)}`,
    `out: ${summary.outPath || ""}`
  ].join("\n"));
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[othello-onnx-eval] failed:", error && error.stack ? error.stack : error);
    process.exit(1);
  });
}

export {
  main,
  parseArgs
};
