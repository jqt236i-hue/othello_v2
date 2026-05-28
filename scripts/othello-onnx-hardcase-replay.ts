"use strict";

const fs = require("fs");
const path = require("path");

function ensureParent(filePath: any) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function isWhiteLossHardcase(record: any) {
  if (!record || record.player !== "white") return false;
  const finalDiff = Number(record.finalDiscDiff);
  const outcome = Number(record.outcome);
  const empties = Number(record.emptiesBefore);
  const winner = String(record.winner || "");
  if (winner === "black") return true;
  if (Number.isFinite(outcome) && outcome < -0.08) return true;
  if (Number.isFinite(finalDiff) && finalDiff < -6) return true;
  if (Number.isFinite(empties) && empties <= 16 && Number.isFinite(outcome) && outcome <= 0) return true;
  return false;
}

function writeWhiteLossHardcases(sourcePaths: any[], destination: any, maxRecords: any) {
  ensureParent(destination);
  const cap = Math.max(1, Number(maxRecords) || 1);
  const out: string[] = [];
  for (const source of sourcePaths) {
    if (!fs.existsSync(source) || out.length >= cap) continue;
    const lines = fs.readFileSync(source, "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim() || out.length >= cap) continue;
      let record = null;
      try {
        record = JSON.parse(line);
      } catch (e) {
        continue;
      }
      if (!isWhiteLossHardcase(record)) continue;
      record.hardcaseSource = "white_loss_replay";
      out.push(JSON.stringify(record));
    }
  }
  fs.writeFileSync(destination, out.length > 0 ? `${out.join("\n")}\n` : "", "utf8");
  return out.length;
}

function buildRepeatedHardcaseSelfplayArgs(hardcaseReplay: any[], replayWeight: any) {
  const args: any[] = [];
  const weight = Math.max(1, Number(replayWeight) || 1);
  for (const item of hardcaseReplay || []) {
    for (let repeat = 0; repeat < weight; repeat += 1) {
      args.push("--selfplay", item);
    }
  }
  return args;
}

function rememberHardcaseReplayPath(hardcaseReplay: any[], hardcasePath: any, replayWindow: any) {
  if (!hardcasePath) return hardcaseReplay;
  hardcaseReplay.push(hardcasePath);
  const cap = Math.max(0, Number(replayWindow) || 0);
  while (hardcaseReplay.length > cap) hardcaseReplay.shift();
  return hardcaseReplay;
}

export {
  buildRepeatedHardcaseSelfplayArgs,
  isWhiteLossHardcase,
  rememberHardcaseReplayPath,
  writeWhiteLossHardcases
};
