#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { DEFAULT_OTHELLO_ONNX_LOOP_ARGS } = require("./othello-onnx-training-defaults");
const {
  buildRepeatedHardcaseSelfplayArgs,
  rememberHardcaseReplayPath,
  writeWhiteLossHardcases
} = require("./othello-onnx-hardcase-replay");

const SCHEMA_VERSION = "othello_onnx_training_loop.v1";

function parseIntArg(value: any, fallback: any, min: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

function parseFloatArg(value: any, fallback: any, min: any, max: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function timestampTag(prefix: any) {
  const d = new Date();
  const pad = (n: any) => String(n).padStart(2, "0");
  return `${prefix}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function resolveProfilePath(profile: any) {
  const raw = String(profile || "").trim();
  if (!raw) return "";
  const direct = path.resolve(process.cwd(), raw);
  if (fs.existsSync(direct)) return direct;
  const named = path.resolve(process.cwd(), "othello-ai", "training", "profiles", `${raw}.json`);
  if (fs.existsSync(named)) return named;
  throw new Error(`othello ONNX training profile not found: ${raw}`);
}

function loadProfileDefaults(argv: any) {
  let profile = "";
  for (let i = 0; i < argv.length; i += 1) {
    const cur = argv[i];
    if (cur === "--profile") {
      profile = String(argv[i + 1] || "");
      break;
    }
  }
  const profilePath = resolveProfilePath(profile);
  if (!profilePath) return { profile: "", profilePath: "", args: {} };
  const payload = JSON.parse(fs.readFileSync(profilePath, "utf8"));
  const defaults = payload && typeof payload === "object" && payload.args && typeof payload.args === "object"
    ? payload.args
    : payload;
  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) {
    throw new Error(`invalid othello ONNX training profile: ${profilePath}`);
  }
  return { profile, profilePath, args: defaults };
}

function parseArgs(argv: any) {
  const profile = loadProfileDefaults(argv);
  const args = {
    ...DEFAULT_OTHELLO_ONNX_LOOP_ARGS,
    ...profile.args,
    profile: profile.profilePath || profile.profile || ""
  };

  for (let i = 0; i < argv.length; i += 1) {
    const cur = argv[i];
    if (cur === "--help" || cur === "-h") args.help = true;
    else if (cur === "--profile") { args.profile = profile.profilePath || String(argv[++i] || ""); }
    else if (cur === "--session-tag") args.sessionTag = String(argv[++i] || "");
    else if (cur === "--iterations") args.iterations = parseIntArg(argv[++i], args.iterations, 1);
    else if (cur === "--train-games") args.trainGames = parseIntArg(argv[++i], args.trainGames, 1);
    else if (cur === "--eval-games") args.evalGames = parseIntArg(argv[++i], args.evalGames, 1);
    else if (cur === "--jobs" || cur === "-j") args.jobs = parseIntArg(argv[++i], args.jobs, 1);
    else if (cur === "--dataset-max-records") args.datasetMaxRecords = parseIntArg(argv[++i], args.datasetMaxRecords, 1);
    else if (cur === "--replay-window") args.replayWindow = parseIntArg(argv[++i], args.replayWindow, 1);
    else if (cur === "--hardcase-replay-window") args.hardcaseReplayWindow = parseIntArg(argv[++i], args.hardcaseReplayWindow, 0);
    else if (cur === "--hardcase-replay-weight") args.hardcaseReplayWeight = parseIntArg(argv[++i], args.hardcaseReplayWeight, 1);
    else if (cur === "--hardcase-max-records") args.hardcaseMaxRecords = parseIntArg(argv[++i], args.hardcaseMaxRecords, 1);
    else if (cur === "--epochs") args.epochs = parseIntArg(argv[++i], args.epochs, 1);
    else if (cur === "--batch-size") args.batchSize = parseIntArg(argv[++i], args.batchSize, 1);
    else if (cur === "--hidden-dim") args.hiddenDim = parseIntArg(argv[++i], args.hiddenDim, 8);
    else if (cur === "--depth") args.depth = parseIntArg(argv[++i], args.depth, 1);
    else if (cur === "--dropout") args.dropout = parseFloatArg(argv[++i], args.dropout, 0, 0.9);
    else if (cur === "--value-loss-weight") args.valueLossWeight = parseFloatArg(argv[++i], args.valueLossWeight, 0, 10);
    else if (cur === "--policy-loss-weight") args.policyLossWeight = parseFloatArg(argv[++i], args.policyLossWeight, 0, 10);
    else if (cur === "--white-sample-weight") args.whiteSampleWeight = parseFloatArg(argv[++i], args.whiteSampleWeight, 0.01, 100);
    else if (cur === "--black-sample-weight") args.blackSampleWeight = parseFloatArg(argv[++i], args.blackSampleWeight, 0.01, 100);
    else if (cur === "--gate-pairs") args.gatePairs = parseIntArg(argv[++i], args.gatePairs, 1);
    else if (cur === "--gate-opening-plies") args.gateOpeningPlies = parseIntArg(argv[++i], args.gateOpeningPlies, 0);
    else if (cur === "--gate-min-white-point-rate") args.gateMinWhitePointRate = parseFloatArg(argv[++i], args.gateMinWhitePointRate, 0, 1);
    else if (cur === "--gate-min-white-disc-diff") args.gateMinWhiteDiscDiff = Number(argv[++i]);
    else if (cur === "--champion-gate-pairs") args.championGatePairs = parseIntArg(argv[++i], args.championGatePairs, 1);
    else if (cur === "--champion-gate-min-point-rate") args.championGateMinPointRate = parseFloatArg(argv[++i], args.championGateMinPointRate, 0, 1);
    else if (cur === "--champion-gate-min-white-point-rate") args.championGateMinWhitePointRate = parseFloatArg(argv[++i], args.championGateMinWhitePointRate, 0, 1);
    else if (cur === "--champion-gate-min-white-disc-diff") args.championGateMinWhiteDiscDiff = Number(argv[++i]);
    else if (cur === "--heuristic-rerank-weight") args.heuristicRerankWeight = parseFloatArg(argv[++i], args.heuristicRerankWeight, 0, 100);
    else if (cur === "--policy-weight") args.policyWeight = parseFloatArg(argv[++i], args.policyWeight, 0, 100);
    else if (cur === "--top-k") args.topK = parseIntArg(argv[++i], args.topK, 1);
    else if (cur === "--white-safety-multiplier") args.whiteSafetyMultiplier = parseFloatArg(argv[++i], args.whiteSafetyMultiplier, 0.1, 100);
    else if (cur === "--seed") args.seed = parseIntArg(argv[++i], args.seed, 0);
    else if (cur === "--opening-plies-min") args.openingPliesMin = parseIntArg(argv[++i], args.openingPliesMin, 0);
    else if (cur === "--opening-plies-max") args.openingPliesMax = parseIntArg(argv[++i], args.openingPliesMax, 0);
    else if (cur === "--opening-preferred-player") args.openingPreferredPlayer = String(argv[++i] || "white");
    else if (cur === "--opening-preferred-player-rate") args.openingPreferredPlayerRate = parseFloatArg(argv[++i], args.openingPreferredPlayerRate, 0, 1);
    else if (cur === "--opening-seed-bank") args.openingSeedBankPath = String(argv[++i] || "");
    else if (cur === "--opening-seed-bank-sample-rate") args.openingSeedBankSampleRate = parseFloatArg(argv[++i], args.openingSeedBankSampleRate, 0, 1);
    else if (cur === "--depth-opening") args.depthOpening = parseIntArg(argv[++i], args.depthOpening, 1);
    else if (cur === "--depth-mid") args.depthMid = parseIntArg(argv[++i], args.depthMid, 1);
    else if (cur === "--depth-end") args.depthEnd = parseIntArg(argv[++i], args.depthEnd, 1);
    else if (cur === "--exact-solve-empties") args.exactSolveEmpties = parseIntArg(argv[++i], args.exactSolveEmpties, 0);
    else if (cur === "--exploration-opening") args.explorationOpening = parseFloatArg(argv[++i], args.explorationOpening, 0, 1);
    else if (cur === "--exploration-mid") args.explorationMid = parseFloatArg(argv[++i], args.explorationMid, 0, 1);
    else if (cur === "--exploration-end") args.explorationEnd = parseFloatArg(argv[++i], args.explorationEnd, 0, 1);
    else if (cur === "--runtime-model-out") args.runtimeModelOut = String(argv[++i] || args.runtimeModelOut);
    else if (cur === "--runtime-meta-out") args.runtimeMetaOut = String(argv[++i] || args.runtimeMetaOut);
    else if (cur === "--champion-model-out") args.championModelOut = String(argv[++i] || args.championModelOut);
    else if (cur === "--champion-meta-out") args.championMetaOut = String(argv[++i] || args.championMetaOut);
    else if (cur === "--init-onnx") args.initOnnx = String(argv[++i] || args.initOnnx);
    else if (cur === "--policy-table") args.policyTable = String(argv[++i] || args.policyTable);
    else if (cur === "--value-table") args.valueTable = String(argv[++i] || args.valueTable);
    else if (cur === "--baseline") args.baseline = String(argv[++i] || args.baseline);
    else if (cur === "--preflight") args.preflight = true;
  }

  if (!args.sessionTag) args.sessionTag = timestampTag("othello_onnx_loop");
  if (args.openingSeedBankPath && !fs.existsSync(path.resolve(process.cwd(), args.openingSeedBankPath))) {
    throw new Error(`opening seed bank not found: ${args.openingSeedBankPath}`);
  }
  if (args.preflight) {
    args.iterations = 1;
    args.trainGames = Math.min(args.trainGames, 16);
    args.evalGames = Math.min(args.evalGames, 8);
    args.datasetMaxRecords = Math.min(args.datasetMaxRecords, 1000);
    args.epochs = Math.min(args.epochs, 1);
    args.gatePairs = Math.min(args.gatePairs, 1);
    args.championGatePairs = Math.min(args.championGatePairs, 1);
  }
  return args;
}

function printHelp() {
  console.log([
    "Usage: node scripts/run-othello-onnx-training-loop.js [options]",
    "  --session-tag <tag>",
    "  --profile <name|path>",
    "  --iterations <n>",
    "  --train-games <n>",
    "  --eval-games <n>",
    "  -j, --jobs <n>",
    "  --preflight",
    "  --gate-pairs <n>",
    "  --champion-gate-pairs <n>",
    "  --champion-gate-min-point-rate <n>",
    "  --champion-gate-min-white-point-rate <n>",
    "  --champion-gate-min-white-disc-diff <n>",
    "  --heuristic-rerank-weight <n>",
    "  --policy-weight <n>",
    "  --top-k <n>",
    "  --white-safety-multiplier <n>",
    "  --policy-loss-weight <n>",
    "  --hardcase-replay-window <n>",
    "  --hardcase-replay-weight <n>",
    "  --opening-seed-bank <path>",
    "  --opening-seed-bank-sample-rate <n>",
    "  --exploration-opening <n>",
    "  --exploration-mid <n>",
    "  --exploration-end <n>",
    "  --runtime-model-out <path>",
    "  --runtime-meta-out <path>",
    "  --init-onnx <path>"
  ].join("\n"));
}

function ensureDir(dirPath: any) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureParent(filePath: any) {
  ensureDir(path.dirname(filePath));
}

function writeJson(filePath: any, payload: any) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function appendLog(filePath: any, line: any) {
  ensureParent(filePath);
  fs.appendFileSync(filePath, `${new Date().toISOString()} ${line}\n`, "utf8");
}

function runCommand(summary: any, stepName: any, command: any, args: any, options: any = null) {
  appendLog(summary.launcherLog, `[${summary.sessionTag}] ${stepName}: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
    shell: false
  });
  if (result.stdout) appendLog(summary.launcherLog, result.stdout.trimEnd());
  if (result.stderr) appendLog(summary.launcherLog, result.stderr.trimEnd());
  if (result.error || result.status !== 0) {
    const msg = result.error ? result.error.message : `${stepName} exited ${result.status}`;
    if (options && options.allowFailure) return { ok: false, error: msg };
    throw new Error(msg);
  }
  return { ok: true };
}

function copyFile(source: any, destination: any) {
  ensureParent(destination);
  fs.copyFileSync(source, destination);
}

function readJsonIfExists(filePath: any) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function summarizeGate(gatePath: any, thresholds: any) {
  const gate = readJsonIfExists(gatePath);
  const totals = gate && gate.totals ? gate.totals : {};
  const pointRate = Number(totals.onnxPointRate || 0);
  const whitePointRate = Number(totals.onnxWhitePointRate || 0);
  const whiteDiff = Number(totals.averageWhiteDiscDiffFromOnnx || 0);
  const minPointRate = Number.isFinite(Number(thresholds.minPointRate)) ? Number(thresholds.minPointRate) : 0;
  const minWhitePointRate = Number.isFinite(Number(thresholds.minWhitePointRate)) ? Number(thresholds.minWhitePointRate) : 0;
  const minWhiteDiscDiff = Number.isFinite(Number(thresholds.minWhiteDiscDiff)) ? Number(thresholds.minWhiteDiscDiff) : Number.NEGATIVE_INFINITY;
  return {
    promoted: pointRate >= minPointRate && whitePointRate >= minWhitePointRate && whiteDiff >= minWhiteDiscDiff,
    whitePointRate,
    averageWhiteDiscDiffFromOnnx: whiteDiff,
    onnxPointRate: pointRate,
    games: Number(totals.games || 0),
    thresholds: {
      minPointRate,
      minWhitePointRate,
      minWhiteDiscDiff
    },
    gate
  };
}

function makeSummary(args: any, runDir: any): any {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessionTag: args.sessionTag,
    status: "running",
    phase: "starting",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    iterationsPlanned: args.iterations,
    iterationsCompleted: 0,
    currentIteration: 1,
    championModelPath: path.resolve(args.championModelOut),
    championMetaPath: path.resolve(args.championMetaOut),
    runtimeModelOut: path.resolve(args.runtimeModelOut),
    runtimeMetaOut: path.resolve(args.runtimeMetaOut),
    launcherLog: path.join(runDir, "launcher.log"),
    runDir,
    config: args,
    history: [],
    lastError: ""
  };
}

function updateSummary(summary: any, summaryPath: any, patch: any) {
  Object.assign(summary, patch || {});
  summary.updatedAt = new Date().toISOString();
  writeJson(summaryPath, summary);
}

function iterationTag(sessionTag: any, iteration: any) {
  return `${sessionTag}.it${String(iteration).padStart(3, "0")}`;
}

function main(argv: any = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  const runDir = path.resolve(process.cwd(), "othello-ai", "data", "runs", args.sessionTag);
  const summaryPath = path.join(runDir, "onnx-training-loop.summary.json");
  ensureDir(runDir);
  const summary = makeSummary(args, runDir);
  writeJson(summaryPath, summary);
  appendLog(summary.launcherLog, `[${args.sessionTag}] start iterations=${args.iterations}`);

  const python = path.resolve(process.cwd(), ".venv", "Scripts", "python.exe");
  const node = process.execPath;
  const replaySelfplay: any[] = [];
  const hardcaseReplay: any[] = [];
  const openingSeedBankArgs = args.openingSeedBankPath
    ? [
        "--opening-seed-bank", args.openingSeedBankPath,
        "--opening-seed-bank-sample-rate", String(args.openingSeedBankSampleRate)
      ]
    : [];

  try {
    for (let iteration = 1; iteration <= args.iterations; iteration += 1) {
      const tag = iterationTag(args.sessionTag, iteration);
      const iterDir = path.resolve(process.cwd(), "othello-ai", "data", "runs", tag);
      ensureDir(iterDir);
      updateSummary(summary, summaryPath, { phase: "selfplay_train", currentIteration: iteration });

      const trainData = path.join(iterDir, `selfplay.train.${tag}.ndjson`);
      const trainSummary = `${trainData}.summary.json`;
      const evalData = path.join(iterDir, `selfplay.eval.${tag}.ndjson`);
      const evalSummary = `${evalData}.summary.json`;
      runCommand(summary, "selfplay_train", node, [
        "dist/othello-ai/training/generate-selfplay-data.js",
        "--games", String(args.trainGames),
        "--jobs", String(args.jobs),
        "--seed", String(args.seed + iteration * 1000),
        "--out", trainData,
        "--summary-out", trainSummary,
        "--policy-model", args.policyTable,
        "--value-model", args.valueTable,
        "--opening-plies-min", String(args.openingPliesMin),
        "--opening-plies-max", String(args.openingPliesMax),
        "--opening-preferred-player", args.openingPreferredPlayer,
        "--opening-preferred-player-rate", String(args.openingPreferredPlayerRate),
        ...openingSeedBankArgs,
        "--depth-opening", String(args.depthOpening),
        "--depth-mid", String(args.depthMid),
        "--depth-end", String(args.depthEnd),
        "--exact-solve-empties", String(args.exactSolveEmpties),
        "--exploration-opening", String(args.explorationOpening),
        "--exploration-mid", String(args.explorationMid),
        "--exploration-end", String(args.explorationEnd)
      ]);

      updateSummary(summary, summaryPath, { phase: "selfplay_eval" });
      runCommand(summary, "selfplay_eval", node, [
        "dist/othello-ai/training/generate-selfplay-data.js",
        "--games", String(args.evalGames),
        "--jobs", String(Math.max(1, Math.min(args.jobs, args.evalGames))),
        "--seed", String(args.seed + iteration * 1000 + 500000),
        "--out", evalData,
        "--summary-out", evalSummary,
        "--policy-model", args.policyTable,
        "--value-model", args.valueTable,
        "--opening-plies-min", String(args.openingPliesMin),
        "--opening-plies-max", String(args.openingPliesMax),
        "--opening-preferred-player", args.openingPreferredPlayer,
        "--opening-preferred-player-rate", String(args.openingPreferredPlayerRate),
        ...openingSeedBankArgs,
        "--depth-opening", String(args.depthOpening),
        "--depth-mid", String(args.depthMid),
        "--depth-end", String(args.depthEnd),
        "--exact-solve-empties", String(args.exactSolveEmpties),
        "--exploration-opening", String(args.explorationOpening),
        "--exploration-mid", String(args.explorationMid),
        "--exploration-end", String(args.explorationEnd)
      ]);

      replaySelfplay.push(trainData, evalData);
      while (replaySelfplay.length > args.replayWindow * 2) replaySelfplay.shift();

      updateSummary(summary, summaryPath, { phase: "build_dataset" });
      const dataset = path.join(iterDir, `teacher.${tag}.jsonl`);
      const datasetSummary = path.join(iterDir, `teacher.${tag}.summary.json`);
      const datasetArgs = [
        "othello-ai/training/build-onnx-teacher-dataset.py",
        "--policy-table", args.policyTable,
        "--value-table", args.valueTable,
        "--out", dataset,
        "--summary-out", datasetSummary,
        "--max-records", String(args.datasetMaxRecords)
      ];
      for (const item of replaySelfplay) datasetArgs.push("--selfplay", item);
      datasetArgs.push(...buildRepeatedHardcaseSelfplayArgs(hardcaseReplay, args.hardcaseReplayWeight));
      runCommand(summary, "build_dataset", python, datasetArgs);

      updateSummary(summary, summaryPath, { phase: "train_onnx" });
      const model = path.join(iterDir, `policy-value.${tag}.onnx`);
      const metrics = path.join(iterDir, `policy-value.${tag}.metrics.json`);
      const initOnnx = args.initOnnx || (fs.existsSync(args.championModelOut) ? args.championModelOut : "");
      const initArgs = initOnnx ? ["--init-onnx", initOnnx] : [];
      runCommand(summary, "train_onnx", python, [
        "othello-ai/training/train-onnx-policy-value.py",
        "--dataset", dataset,
        "--onnx-out", model,
        "--metrics-out", metrics,
        ...initArgs,
        "--epochs", String(args.epochs),
        "--batch-size", String(args.batchSize),
        "--hidden-dim", String(args.hiddenDim),
        "--depth", String(args.depth),
        "--dropout", String(args.dropout),
        "--value-loss-weight", String(args.valueLossWeight),
        "--policy-loss-weight", String(args.policyLossWeight),
        "--white-sample-weight", String(args.whiteSampleWeight),
        "--black-sample-weight", String(args.blackSampleWeight)
      ]);

      updateSummary(summary, summaryPath, { phase: "dataset_eval" });
      const datasetEval = path.join(iterDir, `onnx-dataset.${tag}.eval.json`);
      runCommand(summary, "dataset_eval", node, [
        "scripts/evaluate-othello-onnx.js",
        "--onnx-model", model,
        "--onnx-meta", `${model}.meta.json`,
        "--dataset", dataset,
        "--sample-limit", "2000",
        "--heuristic-rerank-weight", String(args.heuristicRerankWeight),
        "--policy-weight", String(args.policyWeight),
        "--top-k", String(args.topK),
        "--white-safety-multiplier", String(args.whiteSafetyMultiplier),
        "--out", datasetEval
      ]);

      updateSummary(summary, summaryPath, { phase: "white_gate" });
      const gateEval = path.join(iterDir, `onnx-white-gate.${tag}.eval.json`);
      runCommand(summary, "white_gate", node, [
        "scripts/evaluate-othello-onnx.js",
        "--onnx-model", model,
        "--onnx-meta", `${model}.meta.json`,
        "--baseline", args.baseline,
        "--pairs", String(args.gatePairs),
        "--opening-plies", String(args.gateOpeningPlies),
        "--seed", String(args.seed + iteration * 1000 + 900000),
        "--heuristic-rerank-weight", String(args.heuristicRerankWeight),
        "--policy-weight", String(args.policyWeight),
        "--top-k", String(args.topK),
        "--white-safety-multiplier", String(args.whiteSafetyMultiplier),
        "--out", gateEval
      ]);

      const gateResult = summarizeGate(gateEval, {
        minPointRate: 0,
        minWhitePointRate: args.gateMinWhitePointRate,
        minWhiteDiscDiff: args.gateMinWhiteDiscDiff
      });
      updateSummary(summary, summaryPath, { phase: "champion_gate" });
      const championGateEval = path.join(iterDir, `onnx-champion-gate.${tag}.eval.json`);
      runCommand(summary, "champion_gate", node, [
        "scripts/evaluate-othello-onnx.js",
        "--onnx-model", model,
        "--onnx-meta", `${model}.meta.json`,
        "--baseline", "onnx",
        "--baseline-onnx-model", args.championModelOut,
        "--baseline-onnx-meta", args.championMetaOut,
        "--pairs", String(args.championGatePairs),
        "--opening-plies", String(args.gateOpeningPlies),
        "--seed", String(args.seed + iteration * 1000 + 950000),
        "--heuristic-rerank-weight", String(args.heuristicRerankWeight),
        "--policy-weight", String(args.policyWeight),
        "--top-k", String(args.topK),
        "--white-safety-multiplier", String(args.whiteSafetyMultiplier),
        "--out", championGateEval
      ]);
      const championGateResult = summarizeGate(championGateEval, {
        minPointRate: args.championGateMinPointRate,
        minWhitePointRate: args.championGateMinWhitePointRate,
        minWhiteDiscDiff: args.championGateMinWhiteDiscDiff
      });
      let runtimeModelOut = "";
      let runtimeMetaOut = "";
      const shouldPromote = gateResult.promoted && championGateResult.promoted && args.preflight !== true;
      let hardcasePath = "";
      let hardcaseRecords = 0;
      if (!shouldPromote && args.preflight !== true && args.hardcaseReplayWindow > 0) {
        hardcasePath = path.join(iterDir, `hardcases.white-loss.${tag}.ndjson`);
        hardcaseRecords = writeWhiteLossHardcases([trainData, evalData], hardcasePath, args.hardcaseMaxRecords);
        if (hardcaseRecords > 0) {
          rememberHardcaseReplayPath(hardcaseReplay, hardcasePath, args.hardcaseReplayWindow);
          appendLog(summary.launcherLog, `[${args.sessionTag}] hardcase_replay added records=${hardcaseRecords} path=${hardcasePath}`);
        }
      }
      if (shouldPromote) {
        copyFile(model, args.championModelOut);
        copyFile(`${model}.meta.json`, args.championMetaOut);
        copyFile(model, args.runtimeModelOut);
        copyFile(`${model}.meta.json`, args.runtimeMetaOut);
        runtimeModelOut = path.resolve(args.runtimeModelOut);
        runtimeMetaOut = path.resolve(args.runtimeMetaOut);
      }

      const one = {
        iteration,
        runTag: tag,
        trainData,
        evalData,
        dataset,
        model,
        meta: `${model}.meta.json`,
        metrics,
        datasetEval,
        gateEval,
        championGateEval,
        promoted: shouldPromote,
        hardcaseReplayPath: hardcasePath,
        hardcaseReplayRecords: hardcaseRecords,
        gatePassed: gateResult.promoted,
        championGatePassed: championGateResult.promoted,
        gate: {
          whitePointRate: gateResult.whitePointRate,
          averageWhiteDiscDiffFromOnnx: gateResult.averageWhiteDiscDiffFromOnnx,
          onnxPointRate: gateResult.onnxPointRate,
          games: gateResult.games,
          thresholds: gateResult.thresholds
        },
        championGate: {
          whitePointRate: championGateResult.whitePointRate,
          averageWhiteDiscDiffFromOnnx: championGateResult.averageWhiteDiscDiffFromOnnx,
          onnxPointRate: championGateResult.onnxPointRate,
          games: championGateResult.games,
          thresholds: championGateResult.thresholds
        },
        runtimeModelOut,
        runtimeMetaOut,
        completedAt: new Date().toISOString()
      };
      summary.history.push(one);
      updateSummary(summary, summaryPath, {
        phase: "iteration_complete",
        iterationsCompleted: iteration,
        lastRunTag: tag,
        lastModelPath: model,
        lastGate: one.gate,
        lastChampionGate: one.championGate,
        lastPromoted: shouldPromote
      });
      appendLog(summary.launcherLog, `[${args.sessionTag}] iteration ${iteration}/${args.iterations} done promoted=${shouldPromote} gatePassed=${gateResult.promoted} championGatePassed=${championGateResult.promoted} whitePointRate=${gateResult.whitePointRate.toFixed(4)} whiteDiff=${gateResult.averageWhiteDiscDiffFromOnnx.toFixed(2)} championPointRate=${championGateResult.onnxPointRate.toFixed(4)} championWhitePointRate=${championGateResult.whitePointRate.toFixed(4)} championWhiteDiff=${championGateResult.averageWhiteDiscDiffFromOnnx.toFixed(2)}`);
    }

    updateSummary(summary, summaryPath, { status: "completed", phase: "done" });
    appendLog(summary.launcherLog, `[${args.sessionTag}] completed`);
  } catch (error: any) {
    updateSummary(summary, summaryPath, {
      status: "failed",
      phase: "error",
      lastError: error && error.stack ? error.stack : String(error)
    });
    appendLog(summary.launcherLog, `[${args.sessionTag}] failed: ${error && error.stack ? error.stack : error}`);
    process.exit(1);
  }
}

if (require.main === module) main();

export {
  main,
  parseArgs
};
