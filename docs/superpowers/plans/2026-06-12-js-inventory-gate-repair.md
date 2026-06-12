# JS Inventory Gate Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the high-priority JS inventory failures for `othello-ai/*`, `scripts/build-training-cli.js`, and `scripts/generate-othello-selfplay-data.js` without weakening the TypeScript source-of-truth policy.

**Architecture:** Convert implementation-bearing JavaScript into TypeScript source-of-truth files, then reduce the original `.js` files to thin compatibility adapters. Browser-facing `othello-ai` modules must be emitted into `dist/othello-ai/**` and embedded into `public/module-registry.js` from `dist`, not from adapter wrappers.

**Tech Stack:** TypeScript, CommonJS output, Jest, existing `scripts/inventory-js-legacy.ts` gate, existing browser module registry generator.

---

## Scope

This plan covers the high-priority items identified from the failing `npm test` pretest gate:

- `othello-ai/eval/value-table.js`
- `othello-ai/core/board.js`
- `othello-ai/runtime/browser-cpu.js`
- `othello-ai/runtime/engine.js`
- `scripts/build-training-cli.js`
- `scripts/generate-othello-selfplay-data.js`

This plan intentionally does not solve the lower-priority untracked proof scripts:

- `tmp-live-network-proof.js`
- `tmp-live-network-remaining-proof.js`
- `tmp-live-network-special-proof.js`

Those should be handled separately by removing or moving local proof artifacts after confirming they are not needed.

## File Structure

- Modify: `tsconfig.build.json`
  Include `othello-ai/**/*.ts` so `npm run build:ts` emits browser CPU modules into `dist/othello-ai/**`.
- Create: `othello-ai/core/board.ts`
  TypeScript source-of-truth for standard 8x8 Othello board helpers used by the Othello CPU path.
- Modify: `othello-ai/core/board.js`
  Thin CommonJS adapter to `../../dist/othello-ai/core/board`.
- Create: `othello-ai/eval/value-table.ts`
  TypeScript source-of-truth for value-table model classification.
- Modify: `othello-ai/eval/value-table.js`
  Thin CommonJS adapter to `../../dist/othello-ai/eval/value-table`.
- Create: `othello-ai/runtime/engine.ts`
  TypeScript source-of-truth for policy-table and heuristic Othello move selection.
- Modify: `othello-ai/runtime/engine.js`
  Thin CommonJS adapter to `../../dist/othello-ai/runtime/engine`.
- Create: `othello-ai/runtime/browser-cpu.ts`
  TypeScript source-of-truth for browser CPU runtime status and move selection.
- Modify: `othello-ai/runtime/browser-cpu.js`
  Thin CommonJS adapter to `../../dist/othello-ai/runtime/browser-cpu`.
- Create: `scripts/build-training-cli.ts`
  TypeScript source-of-truth for compiling `training/scripts/**/*.ts` into `dist/scripts`.
- Modify: `scripts/build-training-cli.js`
  Thin CLI adapter to `../dist/scripts/build-training-cli`.
- Create: `scripts/generate-othello-selfplay-data.ts`
  TypeScript source-of-truth for Othello selfplay data generation.
- Modify: `scripts/generate-othello-selfplay-data.js`
  Thin CLI adapter to `../dist/scripts/generate-othello-selfplay-data`.
- Modify generated: `public/module-registry.js`
  Regenerate with `npm run build:browser`; do not hand edit.
- Possibly modify generated mirror: `worker-public/public/module-registry.js`
  Only if `npm run worker:prepare` is run and changes it; do not hand edit.
- Do not source-edit: `worker-public/**`
  Mirror output only.

## Task 1: Preflight and Baseline

**Files:**
- Read: `docs/typescript-migration-js-allowlist.md`
- Read: `docs/typescript-migration-js-allowlist.json`
- Read: `scripts/inventory-js-legacy.ts`
- Read: `scripts/build-module-registry.ts`

- [ ] **Step 1: Check working tree**

Run:

```powershell
git status --short
```

Expected: note any pre-existing changes. At time of writing, these unrelated changes existed and must not be overwritten:

```text
 M index.html
 M public/module-registry.js
 M worker-public/index.html
 M worker-public/public/module-registry.js
```

- [ ] **Step 2: Reproduce the failing gate**

Run:

```powershell
npm run checkall
```

Expected: FAIL in `JS-INVENTORY-GATE` with at least:

```text
- unknown files: 1
  - othello-ai/eval/value-table.js
- legacy files without allowlist:
  - othello-ai/core/board.js
  - othello-ai/runtime/browser-cpu.js
  - othello-ai/runtime/engine.js
  - scripts/build-training-cli.js
  - scripts/generate-othello-selfplay-data.js
```

If the failure list is different, stop and update this plan before editing.

- [ ] **Step 3: Confirm target references**

Run:

```powershell
rg -n "othello-ai/(core|eval|runtime)|build-training-cli|generate-othello-selfplay-data" game ui scripts test package.json
```

Expected references include:

```text
game/cpu-decision.ts
ui/handlers/cpu-policy.ts
scripts/build-module-registry.ts
scripts/run-othello-onnx-training-loop.ts
package.json
test/index.sniper-module-load.test.ts
```

## Task 2: Add Othello AI to Build Output

**Files:**
- Modify: `tsconfig.build.json`

- [ ] **Step 1: Update build include**

Add `othello-ai/**/*.ts` to the `include` array in `tsconfig.build.json`:

```json
"include": [
  "game/**/*.ts",
  "ui/**/*.ts",
  "shared/**/*.ts",
  "constants/**/*.ts",
  "workers/**/*.ts",
  "scripts/**/*.ts",
  "story/**/*.ts",
  "cards/**/*.ts",
  "cpu/**/*.ts",
  "src/**/*.ts",
  "utils/**/*.ts",
  "othello-ai/**/*.ts",
  "shared-constants.ts",
  "game-events.ts",
  "sound-engine.ts",
  "ui.ts",
  "is-env-capable.ts",
  "card-system.ts",
  "fix_registry_turnmanager.ts",
  "analyze-selfplay-moves.ts",
  "analyze-destroy-cycle.ts",
  "analyze-crystal-stone.ts",
  "analyze-crystal-stone-quiet.ts",
  "analyze-trap-will.ts"
]
```

- [ ] **Step 2: Run build to confirm no new files are emitted yet**

Run:

```powershell
npm run build:ts
```

Expected: build still reaches `scripts/build-training-cli.js`. It may still pass before TS files exist. If it fails before implementation, capture the error and stop.

## Task 3: Convert `othello-ai/eval/value-table.js`

**Files:**
- Create: `othello-ai/eval/value-table.ts`
- Modify: `othello-ai/eval/value-table.js`

- [ ] **Step 1: Create TypeScript source**

Create `othello-ai/eval/value-table.ts`:

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isValueTableModel(model: unknown): boolean {
  return isRecord(model) && model.schemaVersion === 'value_table.v1';
}

export = {
  isValueTableModel
};
```

- [ ] **Step 2: Replace JS with adapter**

Replace `othello-ai/eval/value-table.js` with:

```js
"use strict";
module.exports = require("../../dist/othello-ai/eval/value-table");
```

- [ ] **Step 3: Verify focused build**

Run:

```powershell
npm run build:ts
node -e "const m=require('./othello-ai/eval/value-table'); if (!m.isValueTableModel({schemaVersion:'value_table.v1'})) process.exit(1); if (m.isValueTableModel({schemaVersion:'x'})) process.exit(1);"
```

Expected: both commands exit 0.

## Task 4: Convert `othello-ai/core/board.js`

**Files:**
- Create: `othello-ai/core/board.ts`
- Modify: `othello-ai/core/board.js`

- [ ] **Step 1: Create TypeScript source**

Create `othello-ai/core/board.ts` by preserving the existing behavior and adding explicit exported types:

```ts
const BLACK = 1;
const WHITE = -1;
const EMPTY = 0;

type Player = typeof BLACK | typeof WHITE;
type Cell = Player | typeof EMPTY;
type Board = Cell[][];
type Move = { row: number; col: number; flips?: Array<{ row: number; col: number }> };

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
];

function createInitialBoard(): Board {
  const board = Array.from({ length: 8 }, () => Array<Cell>(8).fill(EMPTY));
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
  return board;
}

function cloneBoard(board: unknown): Board {
  return Array.isArray(board)
    ? board.map((row) => Array.isArray(row) ? row.slice() as Cell[] : [])
    : createInitialBoard();
}

function inside(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function oppositePlayer(player: number): Player {
  return player === BLACK ? WHITE : BLACK;
}

function playerToKey(player: number): 'black' | 'white' {
  return player === BLACK ? 'black' : 'white';
}

function keyToPlayer(key: unknown): Player {
  return key === 'white' ? WHITE : BLACK;
}

function getCell(board: unknown, row: number, col: number): Cell {
  if (!Array.isArray(board) || !Array.isArray(board[row])) return EMPTY;
  const value = Number(board[row][col]);
  if (value === BLACK || value === WHITE) return value;
  return EMPTY;
}

function getFlips(board: unknown, row: number, col: number, player: number): Array<{ row: number; col: number }> {
  if (!inside(row, col) || getCell(board, row, col) !== EMPTY) return [];
  const opponent = oppositePlayer(player);
  const flips: Array<{ row: number; col: number }> = [];
  for (const [dr, dc] of DIRS) {
    let r = row + dr;
    let c = col + dc;
    const line: Array<{ row: number; col: number }> = [];
    while (inside(r, c) && getCell(board, r, c) === opponent) {
      line.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    if (line.length > 0 && inside(r, c) && getCell(board, r, c) === player) flips.push(...line);
  }
  return flips;
}

function getLegalMoves(board: unknown, player: number): Move[] {
  const moves: Move[] = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const flips = getFlips(board, row, col, player);
      if (flips.length > 0) moves.push({ row, col, flips });
    }
  }
  return moves;
}

function applyMove(board: unknown, move: unknown, player: number): Board {
  const candidate = move && typeof move === 'object' ? move as Move : null;
  const row = Number(candidate && candidate.row);
  const col = Number(candidate && candidate.col);
  const flips = candidate && Array.isArray(candidate.flips) && candidate.flips.length > 0
    ? candidate.flips
    : getFlips(board, row, col, player);
  const next = cloneBoard(board);
  if (!inside(row, col) || flips.length <= 0) return next;
  next[row][col] = player as Cell;
  for (const flip of flips) {
    const r = Number(flip && flip.row);
    const c = Number(flip && flip.col);
    if (inside(r, c)) next[r][c] = player as Cell;
  }
  return next;
}

function countDiscs(board: unknown): { black: number; white: number; empty: number } {
  let black = 0;
  let white = 0;
  let empty = 0;
  for (const row of Array.isArray(board) ? board : []) {
    for (const cell of Array.isArray(row) ? row : []) {
      if (cell === BLACK) black += 1;
      else if (cell === WHITE) white += 1;
      else empty += 1;
    }
  }
  return { black, white, empty };
}

export = {
  BLACK,
  WHITE,
  EMPTY,
  createInitialBoard,
  cloneBoard,
  oppositePlayer,
  playerToKey,
  keyToPlayer,
  getFlips,
  getLegalMoves,
  applyMove,
  countDiscs
};
```

- [ ] **Step 2: Replace JS with adapter**

Replace `othello-ai/core/board.js` with:

```js
"use strict";
module.exports = require("../../dist/othello-ai/core/board");
```

- [ ] **Step 3: Verify board compatibility**

Run:

```powershell
npm run build:ts
node -e "const b=require('./othello-ai/core/board'); const board=b.createInitialBoard(); const moves=b.getLegalMoves(board,b.BLACK); if (!Array.isArray(moves) || moves.length !== 4) process.exit(1); const next=b.applyMove(board,moves[0],b.BLACK); const c=b.countDiscs(next); if (c.black + c.white + c.empty !== 64) process.exit(1);"
```

Expected: exit 0.

## Task 5: Convert `othello-ai/runtime/engine.js`

**Files:**
- Create: `othello-ai/runtime/engine.ts`
- Modify: `othello-ai/runtime/engine.js`

- [ ] **Step 1: Create TypeScript source**

Create `othello-ai/runtime/engine.ts` by preserving the JS algorithm. Keep CommonJS-style import compatibility:

```ts
import Board = require('../core/board');

type LegalMove = { row: number; col: number; flips?: unknown[] };
type EngineContext = { board?: unknown; playerKey?: unknown };
type PolicyState = { bestAction?: unknown };
type PolicyModel = {
  schemaVersion?: unknown;
  states?: Record<string, PolicyState | undefined>;
};
type Models = { policyModel?: PolicyModel };

function validatePolicyModel(model: unknown): model is PolicyModel {
  return !!model && typeof model === 'object' && (model as PolicyModel).schemaVersion === 'policy_table.v2';
}

function normalizeEngineConfig<T>(config: T): T | Record<string, never> {
  return config && typeof config === 'object' ? config : {};
}

function encodeBoard(board: unknown): string {
  return (Array.isArray(board) ? board : [])
    .map((row) =>
      (Array.isArray(row) ? row : [])
        .map((cell) => {
          if (cell === Board.BLACK) return 'B';
          if (cell === Board.WHITE) return 'W';
          return '.';
        })
        .join('')
    )
    .join('/');
}

function transformCoord(row: number, col: number, transformId: number): [number, number] {
  if (transformId === 1) return [col, 7 - row];
  if (transformId === 2) return [7 - row, 7 - col];
  if (transformId === 3) return [7 - col, row];
  if (transformId === 4) return [row, 7 - col];
  if (transformId === 5) return [7 - col, 7 - row];
  if (transformId === 6) return [7 - row, col];
  if (transformId === 7) return [col, row];
  return [row, col];
}

function transformBoard(rows: string[], transformId: number): string {
  const out = Array.from({ length: 8 }, () => Array<string>(8).fill('.'));
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const [r, c] = transformCoord(row, col, transformId);
      out[r][c] = rows[row][col];
    }
  }
  return out.map((row) => row.join('')).join('/');
}

function canonicalize(boardKey: string): { key: string; transformId: number } {
  const rows = String(boardKey || '').split('/');
  if (rows.length !== 8 || rows.some((row) => row.length !== 8)) return { key: boardKey, transformId: 0 };
  let bestKey = '';
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

function inverseTransformCoord(row: number, col: number, transformId: number): { row: number; col: number } {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const mapped = transformCoord(r, c, transformId);
      if (mapped[0] === row && mapped[1] === col) return { row: r, col: c };
    }
  }
  return { row, col };
}

function parseAction(action: unknown): { row: number; col: number } | null {
  const parts = String(action || '').split(':');
  if (parts.length !== 3 || parts[0] !== 'place') return null;
  const row = Number(parts[1]);
  const col = Number(parts[2]);
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 7 || col < 0 || col > 7) return null;
  return { row, col };
}

function resolveTableMove(legalMoves: LegalMove[], board: unknown, playerKey: unknown, policyModel: unknown): LegalMove | null {
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

function isCorner(move: LegalMove | null | undefined): boolean {
  return !!move && (move.row === 0 || move.row === 7) && (move.col === 0 || move.col === 7);
}

function isEdge(move: LegalMove | null | undefined): boolean {
  return !!move && !isCorner(move) && (move.row === 0 || move.row === 7 || move.col === 0 || move.col === 7);
}

function isXSquare(move: LegalMove | null | undefined): boolean {
  return !!move && (move.row === 1 || move.row === 6) && (move.col === 1 || move.col === 6);
}

function chooseHeuristicMove(legalMoves: LegalMove[], context: EngineContext): LegalMove | null {
  const board = context && context.board;
  const player = Board.keyToPlayer(context && context.playerKey);
  let best: LegalMove | null = null;
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

function chooseEngineMove(legalMoves: LegalMove[], context: EngineContext, models: Models): LegalMove | null {
  const tableMove = resolveTableMove(
    legalMoves,
    context && context.board,
    context && context.playerKey,
    models && models.policyModel
  );
  return tableMove || chooseHeuristicMove(legalMoves, context);
}

export = {
  validatePolicyModel,
  normalizeEngineConfig,
  chooseEngineMove
};
```

- [ ] **Step 2: Replace JS with adapter**

Replace `othello-ai/runtime/engine.js` with:

```js
"use strict";
module.exports = require("../../dist/othello-ai/runtime/engine");
```

- [ ] **Step 3: Verify engine behavior**

Run:

```powershell
npm run build:ts
node -e "const b=require('./othello-ai/core/board'); const e=require('./othello-ai/runtime/engine'); const board=b.createInitialBoard(); const legal=b.getLegalMoves(board,b.BLACK); const move=e.chooseEngineMove(legal,{board,playerKey:'black'},{}); if (!move || !Number.isInteger(move.row) || !Number.isInteger(move.col)) process.exit(1);"
```

Expected: exit 0.

## Task 6: Convert `othello-ai/runtime/browser-cpu.js`

**Files:**
- Create: `othello-ai/runtime/browser-cpu.ts`
- Modify: `othello-ai/runtime/browser-cpu.js`

- [ ] **Step 1: Create TypeScript source**

Create `othello-ai/runtime/browser-cpu.ts`:

```ts
import Engine = require('./engine');

type RuntimeStatus = {
  loaded: boolean;
  valueLoaded: boolean;
};

type BrowserCpuContext = {
  models?: Record<string, unknown>;
  [key: string]: unknown;
};

const status: RuntimeStatus = {
  loaded: false,
  valueLoaded: false
};

function getStatus(): RuntimeStatus {
  return {
    loaded: status.loaded,
    valueLoaded: status.valueLoaded
  };
}

function setStatus(nextStatus: unknown): RuntimeStatus {
  if (!nextStatus || typeof nextStatus !== 'object') return getStatus();
  const record = nextStatus as Partial<RuntimeStatus>;
  status.loaded = record.loaded === true;
  status.valueLoaded = record.valueLoaded === true;
  return getStatus();
}

function chooseMove(legalMoves: Array<{ row: number; col: number; flips?: unknown[] }>, context: BrowserCpuContext | null | undefined) {
  const models = context && context.models && typeof context.models === 'object'
    ? context.models
    : {};
  return Engine.chooseEngineMove(legalMoves, context || {}, models);
}

export = {
  getStatus,
  setStatus,
  chooseMove
};
```

- [ ] **Step 2: Replace JS with adapter**

Replace `othello-ai/runtime/browser-cpu.js` with:

```js
"use strict";
module.exports = require("../../dist/othello-ai/runtime/browser-cpu");
```

- [ ] **Step 3: Verify browser CPU runtime**

Run:

```powershell
npm run build:ts
node -e "const b=require('./othello-ai/core/board'); const cpu=require('./othello-ai/runtime/browser-cpu'); const s=cpu.setStatus({loaded:true,valueLoaded:true}); if (!s.loaded || !s.valueLoaded) process.exit(1); const board=b.createInitialBoard(); const move=cpu.chooseMove(b.getLegalMoves(board,b.BLACK),{board,playerKey:'black'}); if (!move) process.exit(1);"
```

Expected: exit 0.

## Task 7: Convert `scripts/build-training-cli.js`

**Files:**
- Create: `scripts/build-training-cli.ts`
- Modify: `scripts/build-training-cli.js`

- [ ] **Step 1: Create TypeScript source**

Create `scripts/build-training-cli.ts` by porting the existing implementation:

```ts
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const repoRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(repoRoot, 'training', 'scripts');
const outRoot = path.join(repoRoot, 'dist', 'scripts');

function walkTsFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(fullPath);
    }
  }
  return out;
}

function ensureParent(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function emitFile(sourcePath: string): string {
  const rel = path.relative(sourceRoot, sourcePath);
  const outPath = path.join(outRoot, rel).replace(/\.ts$/i, '.js');
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const result = ts.transpileModule(sourceText, {
    fileName: sourcePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      sourceMap: true
    }
  });
  ensureParent(outPath);
  fs.writeFileSync(outPath, result.outputText, 'utf8');
  if (result.sourceMapText) {
    fs.writeFileSync(`${outPath}.map`, result.sourceMapText, 'utf8');
  }
  return outPath;
}

function main(): void {
  const files = walkTsFiles(sourceRoot);
  for (const file of files) {
    emitFile(file);
  }
  console.log(`[build-training-cli] emitted ${files.length} files to ${path.relative(repoRoot, outRoot)}`);
}

if (require.main === module) {
  main();
}

export = {
  emitFile,
  walkTsFiles,
  main
};
```

- [ ] **Step 2: Replace JS with CLI adapter**

Replace `scripts/build-training-cli.js` with:

```js
#!/usr/bin/env node
"use strict";

const mod = require("../dist/scripts/build-training-cli");

if (require.main === module) {
  mod.main();
}

module.exports = mod;
```

- [ ] **Step 3: Verify build script**

Run:

```powershell
npm run build:ts
node -e "const m=require('./scripts/build-training-cli'); if (typeof m.emitFile !== 'function' || typeof m.walkTsFiles !== 'function') process.exit(1);"
```

Expected: exit 0.

## Task 8: Convert `scripts/generate-othello-selfplay-data.js`

**Files:**
- Create: `scripts/generate-othello-selfplay-data.ts`
- Modify: `scripts/generate-othello-selfplay-data.js`

- [ ] **Step 1: Port implementation to TypeScript**

Create `scripts/generate-othello-selfplay-data.ts` by moving the full current body from `scripts/generate-othello-selfplay-data.js` and applying these concrete typing rules:

```ts
#!/usr/bin/env node
/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';
```

Use these shared types near the top:

```ts
type Args = Record<string, string | boolean>;
type Rng = {
  next(): number;
  int(max: number): number;
  pick<T>(items: T[]): T;
};
type Player = 1 | -1;
type Cell = Player | 0;
type Board = Cell[][];
type FlipTuple = [number, number];
type Move = { row: number; col: number; flips: FlipTuple[] };
type SelfplayOptions = {
  maxPlies: number;
  openingPliesMin: number;
  openingPliesMax: number;
  openingPreferredPlayer: string;
  openingPreferredPlayerRate: number;
  depthOpening: number;
  depthMid: number;
  depthEnd: number;
  exactSolveEmpties: number;
  explorationOpening: number;
  explorationMid: number;
  explorationEnd: number;
  quiet: boolean;
};
type SelfplayRecord = {
  schemaVersion: string;
  gameIndex: number;
  seed: number;
  ply: number;
  player: 'black' | 'white';
  board: string;
  legalMoves: string[];
  action: string;
  policy: Record<string, number>;
  value: number;
  outcome?: number;
  finalDiscDiff?: number;
  winner?: 'black' | 'white' | 'draw';
};
```

Apply these mechanical replacements while preserving logic:

```text
const fs = require("fs");            -> import * as fs from 'fs';
const path = require("path");        -> import * as path from 'path';
const BLACK = 1;                     -> const BLACK: Player = 1;
const WHITE = -1;                    -> const WHITE: Player = -1;
const EMPTY = 0;                     -> const EMPTY = 0;
function parseArgs(argv)             -> function parseArgs(argv: string[]): Args
function intArg(args, key, fallback) -> function intArg(args: Args, key: string, fallback: number): number
function floatArg(...)               -> function floatArg(args: Args, key: string, fallback: number): number
function boolArg(...)                -> function boolArg(args: Args, key: string, fallback: boolean): boolean
function createRng(seed)             -> function createRng(seed: number): Rng
function createInitialBoard()        -> function createInitialBoard(): Board
function cloneBoard(board)           -> function cloneBoard(board: Board): Board
function inBounds(row, col)          -> function inBounds(row: number, col: number): boolean
function getFlips(...)               -> function getFlips(board: Board, row: number, col: number, player: Player): FlipTuple[]
function getLegalMoves(...)          -> function getLegalMoves(board: Board, player: Player): Move[]
function applyMove(...)              -> function applyMove(board: Board, move: Move, player: Player): Board
function countDiscs(board)           -> function countDiscs(board: Board): { black: number; white: number; empty: number }
function writeJson(filePath, value)  -> function writeJson(filePath: string, value: unknown): void
async function main()                -> async function main(): Promise<void>
```

At the end, export `main` for adapter compatibility:

```ts
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error && typeof error === 'object' && 'stack' in error ? (error as { stack?: unknown }).stack : String(error));
    process.exit(1);
  });
}

export = {
  main
};
```

Do not change CLI flags, output schema, RNG, move ordering, or scoring logic in this task.

- [ ] **Step 2: Replace JS with CLI adapter**

Replace `scripts/generate-othello-selfplay-data.js` with:

```js
#!/usr/bin/env node
"use strict";

const mod = require("../dist/scripts/generate-othello-selfplay-data");

if (require.main === module) {
  Promise.resolve(mod.main()).catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}

module.exports = mod;
```

- [ ] **Step 3: Verify small selfplay output**

Run:

```powershell
npm run build:ts
node scripts/generate-othello-selfplay-data.js --games 2 --seed 123 --out tmp/othello-selfplay-smoke.ndjson --summary-out tmp/othello-selfplay-smoke-summary.json --quiet
node -e "const fs=require('fs'); const rows=fs.readFileSync('tmp/othello-selfplay-smoke.ndjson','utf8').trim().split(/\n/).filter(Boolean); const summary=JSON.parse(fs.readFileSync('tmp/othello-selfplay-smoke-summary.json','utf8')); if (rows.length <= 0 || summary.games !== 2 || summary.status !== 'completed') process.exit(1);"
```

Expected: exit 0. The generated files are under `tmp/`, which is skipped by inventory.

## Task 9: Regenerate Browser Registry

**Files:**
- Generated: `public/module-registry.js`
- Possible generated sync: `index.html`

- [ ] **Step 1: Rebuild browser registry**

Run:

```powershell
npm run build:browser
```

Expected:

- `dist/othello-ai/core/board.js` exists.
- `dist/othello-ai/eval/value-table.js` exists.
- `dist/othello-ai/runtime/browser-cpu.js` exists.
- `dist/othello-ai/runtime/engine.js` exists.
- `public/module-registry.js` embeds implementation content from `dist/othello-ai/**`, not `module.exports = require("../../dist/...")`.

Check:

```powershell
Select-String -Path public/module-registry.js -Pattern "othello-ai/runtime/browser-cpu"
Select-String -Path public/module-registry.js -Pattern "chooseEngineMove"
Select-String -Path public/module-registry.js -Pattern "dist/othello-ai"
```

Expected: first two commands find matches; the third command should not show the wrapper require embedded for these modules.

- [ ] **Step 2: Run focused browser module test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/index.sniper-module-load.test.ts
```

Expected: PASS.

## Task 10: Inventory Gate Verification

**Files:**
- Validate: `scripts/inventory-js-legacy.ts`
- Validate: `docs/typescript-migration-js-allowlist.json`

- [ ] **Step 1: Build gate script**

Run:

```powershell
npm run build:ts
```

Expected: PASS.

- [ ] **Step 2: Run inventory gate directly**

Run:

```powershell
node dist/scripts/inventory-js-legacy.js
```

Expected:

```text
[JS-INVENTORY-GATE] PASSED
```

Expected target classifications:

```text
dist-wrapper         TS     ...   othello-ai/core/board.js
dist-wrapper         TS     ...   othello-ai/eval/value-table.js
dist-wrapper         TS     ...   othello-ai/runtime/browser-cpu.js
dist-wrapper         TS     ...   othello-ai/runtime/engine.js
node-cli-adapter     TS     ...   scripts/build-training-cli.js
node-cli-adapter     TS     ...   scripts/generate-othello-selfplay-data.js
```

Do not add these files to `docs/typescript-migration-js-allowlist.json` unless the gate requires a category mismatch fix. The desired end state is natural classification, not a new legacy exception.

## Task 11: Full Verification

**Files:**
- Validate all touched source and generated outputs.

- [ ] **Step 1: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run checkall**

Run:

```powershell
npm run checkall
```

Expected: PASS.

- [ ] **Step 3: Run focused tests for changed paths**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/index.sniper-module-load.test.ts test/scripts.evaluate-othello-onnx.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run package test entry**

Run:

```powershell
npm test
```

Expected: `pretest` now passes. If Jest still hangs after `checkall`, report that as a separate Jest runtime issue because this plan only resolves the JS inventory gate blocker.

- [ ] **Step 5: Optional worker mirror sync**

Run this only if `public/module-registry.js` or `index.html` changed and the change needs deploy-surface parity:

```powershell
npm run worker:prepare
```

Expected: PASS. Stage worker mirror output only if it was intentionally regenerated for this task.

## Task 12: Diff Review and Commit

**Files:**
- Review all changed files from this plan.

- [ ] **Step 1: Inspect status**

Run:

```powershell
git status --short
```

Expected changed files for this task include only:

```text
 M tsconfig.build.json
 M othello-ai/core/board.js
 A othello-ai/core/board.ts
 M othello-ai/eval/value-table.js
 A othello-ai/eval/value-table.ts
 M othello-ai/runtime/browser-cpu.js
 A othello-ai/runtime/browser-cpu.ts
 M othello-ai/runtime/engine.js
 A othello-ai/runtime/engine.ts
 M scripts/build-training-cli.js
 A scripts/build-training-cli.ts
 M scripts/generate-othello-selfplay-data.js
 A scripts/generate-othello-selfplay-data.ts
 M public/module-registry.js
```

`index.html` and `worker-public/**` may appear if regeneration intentionally updated cache/version or mirror output. Do not stage unrelated pre-existing changes unless you confirmed they were produced by this task.

- [ ] **Step 2: Inspect relevant diff**

Run:

```powershell
git diff -- tsconfig.build.json othello-ai scripts public/module-registry.js
```

Expected:

- `.ts` files contain implementation.
- `.js` files are thin adapters.
- `public/module-registry.js` contains generated `othello-ai` implementation from `dist`.
- No source edit was made under `worker-public/**`.

- [ ] **Step 3: Stage only task files**

Run:

```powershell
git add tsconfig.build.json othello-ai/core/board.ts othello-ai/core/board.js othello-ai/eval/value-table.ts othello-ai/eval/value-table.js othello-ai/runtime/engine.ts othello-ai/runtime/engine.js othello-ai/runtime/browser-cpu.ts othello-ai/runtime/browser-cpu.js scripts/build-training-cli.ts scripts/build-training-cli.js scripts/generate-othello-selfplay-data.ts scripts/generate-othello-selfplay-data.js public/module-registry.js
```

If `worker:prepare` intentionally changed mirror files, stage them explicitly:

```powershell
git add worker-public/index.html worker-public/public/module-registry.js
```

- [ ] **Step 4: Commit**

Run:

```powershell
git commit -m "Fix JS inventory gate for Othello CPU scripts"
```

Expected: commit succeeds.

## Risk Notes

- The `othello-ai` modules are browser-facing. The registry must register compiled implementation content from `dist/othello-ai/**`; registering root wrapper content would break browser runtime resolution.
- `scripts/build-training-cli.js` is used by `npm run build:ts` after `tsc` completes, so the adapter must require `../dist/scripts/build-training-cli` and the TS source must be included in `scripts/**/*.ts`.
- `scripts/generate-othello-selfplay-data.js` is called by `scripts/run-othello-onnx-training-loop.ts`; keep the same CLI flags and output schema.
- Do not solve this by allowlisting new `legacy-implementation` entries. The documented target state is `legacy-implementation=0` and `unknown=0`.
