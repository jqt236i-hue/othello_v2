# Rated Glicko-2 System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存のレート戦キューに、Glicko-2 の本格レート更新、サーバー保存、二重更新防止、切断敗北、レートランキング表示を追加する。

**Architecture:** レート計算は `shared/` の純粋関数に置き、Worker と Jest から同じ実装を使う。永続レート状態は通常スコアランキングと混ぜず、`MATCH_ROOM` Durable Object 名前空間内の特別 roomId `__rating_pool_card_ranked_v1__` へ集約して、1プール内の更新を直列化する。対局 DO は終局を確定する権威、レートプール DO はレート保存と二重更新防止の権威として分離する。

**Tech Stack:** TypeScript, Jest, Cloudflare Workers Durable Objects, existing `MATCH_ROOM` binding, existing browser network client.

---

## Scope And Decisions

- レートプールは `card_ranked_v1` だけを実装する。
- 初期値は `rating=1500`, `deviation=350`, `volatility=0.06` とする。
- 仮レート、認定戦、配置戦は実装しない。
- 1試合を1 rating period として、終局ごとに即時更新する。
- 既存のスコアランキングとレートランキングは同じ保存データにも同じ UI 表にも混在させない。
- 初期永続化は D1 ではなく既存の `MATCH_ROOM` Durable Object 特別 roomId を使う。理由は、この repo ではロビー、スコアランキング、プレイヤーIDも同じ DO パターンで動いており、1プール更新の直列化と idempotency が最小差分で実装できるため。
- 同一 `playerId` は、同時に1つのレート戦キューまたは進行中レート戦だけ持てる。
- 切断敗北は一時切断を即負けにしない。片方だけが切断し、相手が接続したまま猶予時間を超えた場合に敗北を確定する。

## File Structure

### Create

- `shared/rating-contract.ts`
  - レートプール名、Glicko-2 設定、保存型、公開レスポンス型、正規化関数を持つ。
- `shared/glicko2-rating.ts`
  - Glicko-2 の純粋計算、表示丸め、1対1同時更新を持つ。
- `workers/match-worker-rating.ts`
  - Durable Object storage 上の rating store helper。`applyRatedResult`, `listLeaderboard`, `getPlayerRating`, `claimActiveRatedMatch`, `releaseActiveRatedMatch` を持つ。
- `test/rating.glicko2.test.ts`
  - 純粋計算の固定テスト。
- `test/workers.match-rating.test.ts`
  - storage helper の二重更新、ランキング、NO_CONTEST、同時更新テスト。
- `test/workers.match-rated-result.test.ts`
  - Worker のレート戦終局連携テスト。

### Modify

- `01-rulebook.md`
  - 現在の「本格的なレート計算は後続フェーズ」を、採用仕様に置き換える。
- `docs/architecture-contracts.md`
  - レート権威の境界を追記する。
- `workers/match-worker-types.ts`
  - `MatchWorkerRatedMatch*` 型を追加する。
- `workers/match-worker.ts`
  - `__rating_pool_card_ranked_v1__` の特別 roomId、レート API、終局連携、切断敗北を追加する。
- `workers/match-worker-api.ts`
  - レートプール DO への internal fetch helper を追加する。
- `shared/rated-matchmaking.ts`
  - `matchId`, `pool`, `systemVersion` をキュー成立結果へ含める。
- `scripts/local-match-server.ts`
  - ローカル検証用に Worker と同じレート保存 helper を使う。
- `ui/network-client.ts`
  - `getMyRating`, `getRatedLeaderboard` と終局 rating result の受信を追加する。
- `ui/handlers/match-mode/rated-match.ts`
  - 待機パネルに現在レートを表示する。
- `ui/handlers/match-mode/leaderboard-controller.ts`
  - 既存スコアランキングとは別のレートランキングビューを追加する。
- `scripts/prepare-worker-assets.ts`
  - 新規 shared module が worker mirror に入るか確認し、必要ならコピー対象を追加する。

---

## Task 1: Spec And Boundary Update

**Files:**
- Modify: `01-rulebook.md`
- Modify: `docs/architecture-contracts.md`

- [ ] **Step 1: Replace the current short rated note in `01-rulebook.md`**

Replace the current lines around the existing rated battle section with a full section headed `## 15. レート戦`. Preserve the already implemented queue UI requirements, then add these subsections:

```markdown
## 15. レート戦

### 15.1 キューと対局条件

- 画面左下の固定 `レート戦` ボタンは `ネット対戦` の直下に表示する。
- `レート戦` ボタン押下では現在の `CPU` / `リバーシ` / `ネット対戦` モードを即時変更せず、中央のレート戦待機パネルだけを表示する。
- キュー待機は最大10分とし、10分を超えた場合は自動で待機解除する。
- キュー待機中も通常ゲームプレイは継続できる。待機中は盤面外フレーム右上のフレーム内に残り時間タイマーを常時表示する。
- サーバー側で同時に待機中のプレイヤー同士を自動マッチングし、成立時だけ `ネット対戦` セッションへ切り替えて対局部屋へ接続する。
- レート戦の部屋は通常の `ルーム一覧` には表示しない。
- 初期制約は、デッキ持ち込み可、ベース盤面 `8x8` 固定、AUTO 無効とする。

### 15.2 レートプールと初期値

- レート戦の実力評価には `Glicko-2` を使用する。
- レートプールは `card_ranked_v1` だけを使用する。
- 初期レートは `1500`、初期RDは `350`、初期ボラティリティは `0.06` とする。
- 仮レート、認定戦、配置戦は設けない。
- 1回のレート戦を1つの rating period として、終局ごとに即時更新する。
- 表示するのは整数レートだけとし、RD とボラティリティは内部値として保持する。
- レートと既存のスコアランキングは完全に分離する。
```

Continue the section with the accepted requirements: eligibility, result values, forfeit/disconnect/no contest, Glicko-2 formula, simultaneous update, idempotency, display format, ranking, saved data, versioning, tests.

- [ ] **Step 2: Add architecture boundary text to `docs/architecture-contracts.md`**

Add this paragraph under the network/authority boundary section:

```markdown
### Rated Rating Authority

レート戦の終局結果は対局 Durable Object がサーバー権威として確定する。Glicko-2 の計算は `shared/glicko2-rating.ts` の純粋関数だけを使用し、保存と二重更新防止は `card_ranked_v1` の rating pool Durable Object が担当する。クライアントから送信されたレート、勝敗数、増減量は信用しない。通常スコアランキング、プロフィール、レートランキングは保存データを分離し、UI だけで必要に応じて並べて表示する。
```

- [ ] **Step 3: Inspect documentation diff**

Run:

```powershell
git diff -- 01-rulebook.md docs/architecture-contracts.md
git diff --check -- 01-rulebook.md docs/architecture-contracts.md
```

Expected:

```text
warning: in the working copy ... LF will be replaced by CRLF ...
```

No `trailing whitespace` or `space before tab` errors should appear.

- [ ] **Step 4: Commit the spec update when isolated**

Run only if the working tree has no unrelated staged files:

```powershell
git add 01-rulebook.md docs/architecture-contracts.md
git commit -m "docs: define rated glicko2 system"
```

Expected:

```text
[branch ...] docs: define rated glicko2 system
```

If unrelated dirty files are present, leave the docs uncommitted and report the exact dirty paths.

---

## Task 2: Shared Rating Contract

**Files:**
- Create: `shared/rating-contract.ts`
- Modify: `workers/match-worker-types.ts`
- Test: `npm run build:ts`

- [ ] **Step 1: Create `shared/rating-contract.ts`**

Add:

```ts
'use strict';

export const RATED_POOL_CARD_RANKED_V1 = 'card_ranked_v1' as const;
export const RATING_SYSTEM_VERSION = 1;

export const RATING_CONFIG = Object.freeze({
  pool: RATED_POOL_CARD_RANKED_V1,
  algorithm: 'glicko2',
  systemVersion: RATING_SYSTEM_VERSION,
  initialRating: 1500,
  initialDeviation: 350,
  initialVolatility: 0.06,
  tau: 0.5,
  epsilon: 0.000001,
  scale: 173.7178,
  provisionalMatches: 0,
  ratingPeriod: 'one_match',
  inactivityInflation: false
});

export type RatedPool = typeof RATED_POOL_CARD_RANKED_V1;
export type RatedResult = 'BLACK_WIN' | 'WHITE_WIN' | 'DRAW' | 'NO_CONTEST';
export type RatedSeat = 'black' | 'white';

export type PlayerRating = {
  playerId: string;
  pool: RatedPool;
  systemVersion: number;
  rating: number;
  deviation: number;
  volatility: number;
  ratedGames: number;
  wins: number;
  draws: number;
  losses: number;
  lastRatedAt: string | null;
  updatedAt: string;
};

export type RatingMatchRecord = {
  matchId: string;
  pool: RatedPool;
  systemVersion: number;
  blackPlayerId: string;
  whitePlayerId: string;
  result: Exclude<RatedResult, 'NO_CONTEST'>;
  blackBeforeRating: number;
  blackBeforeDeviation: number;
  blackBeforeVolatility: number;
  blackAfterRating: number;
  blackAfterDeviation: number;
  blackAfterVolatility: number;
  whiteBeforeRating: number;
  whiteBeforeDeviation: number;
  whiteBeforeVolatility: number;
  whiteAfterRating: number;
  whiteAfterDeviation: number;
  whiteAfterVolatility: number;
  rulesetVersion: string;
  catalogVersion: string;
  ratedAt: string;
};

export type RatingDisplayChange = {
  before: number;
  after: number;
  delta: number;
};

export function normalizeRatedPool(value: unknown): RatedPool | null {
  return value === RATED_POOL_CARD_RANKED_V1 ? RATED_POOL_CARD_RANKED_V1 : null;
}

export function normalizeRatedResult(value: unknown): RatedResult | null {
  if (value === 'BLACK_WIN' || value === 'WHITE_WIN' || value === 'DRAW' || value === 'NO_CONTEST') {
    return value;
  }
  return null;
}

export function createInitialPlayerRating(playerId: string, nowIso: string): PlayerRating {
  return {
    playerId,
    pool: RATED_POOL_CARD_RANKED_V1,
    systemVersion: RATING_SYSTEM_VERSION,
    rating: RATING_CONFIG.initialRating,
    deviation: RATING_CONFIG.initialDeviation,
    volatility: RATING_CONFIG.initialVolatility,
    ratedGames: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    lastRatedAt: null,
    updatedAt: nowIso
  };
}
```

- [ ] **Step 2: Add rating types to `workers/match-worker-types.ts`**

Import the shared types near the existing imports:

```ts
import type { PlayerRating, RatingMatchRecord, RatedPool } from '../shared/rating-contract';
```

Append:

```ts
export interface MatchWorkerRatingStore {
    version: number;
    pool: RatedPool;
    players: Record<string, PlayerRating>;
    matches: Record<string, RatingMatchRecord>;
    activeMatches: Record<string, MatchWorkerActiveRatedMatch>;
    updatedAt: string;
}

export interface MatchWorkerActiveRatedMatch {
    matchId: string;
    pool: RatedPool;
    roomId: string;
    playerIds: string[];
    startedAt: string;
}
```

- [ ] **Step 3: Run type build**

Run:

```powershell
npm run build:ts
```

Expected:

```text
> ... build:ts
```

Exit code must be `0`.

- [ ] **Step 4: Commit the contract**

```powershell
git add shared/rating-contract.ts workers/match-worker-types.ts
git commit -m "feat: add rated rating contract"
```

---

## Task 3: Pure Glicko-2 Calculation

**Files:**
- Create: `shared/glicko2-rating.ts`
- Create: `test/rating.glicko2.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/rating.glicko2.test.ts`:

```ts
import {
  computeGlicko2PairUpdate,
  toDisplayRatingChange
} from '../shared/glicko2-rating';
import { createInitialPlayerRating } from '../shared/rating-contract';

describe('glicko2 rated pair update', () => {
  const nowIso = '2026-06-25T00:00:00.000Z';

  test('new player win is displayed as about 1662 vs 1338', () => {
    const black = createInitialPlayerRating('black-player', nowIso);
    const white = createInitialPlayerRating('white-player', nowIso);

    const result = computeGlicko2PairUpdate({ black, white, result: 'BLACK_WIN', ratedAt: nowIso });

    expect(Math.round(result.black.rating)).toBe(1662);
    expect(Math.round(result.white.rating)).toBe(1338);
    expect(result.black.deviation).toBeCloseTo(290.319, 3);
    expect(result.white.deviation).toBeCloseTo(290.319, 3);
  });

  test('new player draw keeps displayed rating at 1500', () => {
    const black = createInitialPlayerRating('black-player', nowIso);
    const white = createInitialPlayerRating('white-player', nowIso);

    const result = computeGlicko2PairUpdate({ black, white, result: 'DRAW', ratedAt: nowIso });

    expect(Math.round(result.black.rating)).toBe(1500);
    expect(Math.round(result.white.rating)).toBe(1500);
  });

  test('display delta is after rounded rating minus before rounded rating', () => {
    const change = toDisplayRatingChange(1500, 1662.3109);

    expect(change).toEqual({ before: 1500, after: 1662, delta: 162 });
  });
});
```

- [ ] **Step 2: Verify tests fail before implementation**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\rating.glicko2.test.ts
```

Expected:

```text
Cannot find module '../shared/glicko2-rating'
```

- [ ] **Step 3: Create `shared/glicko2-rating.ts`**

Implement these exported functions and keep all math in double precision:

```ts
'use strict';

import {
  PlayerRating,
  RatedResult,
  RatingDisplayChange,
  RATING_CONFIG
} from './rating-contract';

export type Glicko2PairUpdateInput = {
  black: PlayerRating;
  white: PlayerRating;
  result: Exclude<RatedResult, 'NO_CONTEST'>;
  ratedAt: string;
};

export type Glicko2PairUpdateResult = {
  black: PlayerRating;
  white: PlayerRating;
  blackDisplay: RatingDisplayChange;
  whiteDisplay: RatingDisplayChange;
};

function scoreFor(result: Exclude<RatedResult, 'NO_CONTEST'>, seat: 'black' | 'white'): number {
  if (result === 'DRAW') return 0.5;
  if (result === 'BLACK_WIN') return seat === 'black' ? 1 : 0;
  return seat === 'white' ? 1 : 0;
}

function toMu(rating: number): number {
  return (rating - RATING_CONFIG.initialRating) / RATING_CONFIG.scale;
}

function toPhi(deviation: number): number {
  return deviation / RATING_CONFIG.scale;
}

function fromMu(mu: number): number {
  return (RATING_CONFIG.scale * mu) + RATING_CONFIG.initialRating;
}

function fromPhi(phi: number): number {
  return RATING_CONFIG.scale * phi;
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expected(mu: number, opponentMu: number, opponentPhi: number): number {
  return 1 / (1 + Math.exp(-g(opponentPhi) * (mu - opponentMu)));
}

function calculateNewVolatility(phi: number, volatility: number, v: number, delta: number): number {
  const tau = RATING_CONFIG.tau;
  const epsilon = RATING_CONFIG.epsilon;
  const a = Math.log(volatility * volatility);

  function f(x: number): number {
    const expX = Math.exp(x);
    const numerator = expX * (delta * delta - phi * phi - v - expX);
    const denominator = 2 * Math.pow(phi * phi + v + expX, 2);
    return (numerator / denominator) - ((x - a) / (tau * tau));
  }

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k += 1;
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > epsilon) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

function updateOne(player: PlayerRating, opponent: PlayerRating, resultScore: number, ratedAt: string, outcome: 'win' | 'draw' | 'loss'): PlayerRating {
  const mu = toMu(player.rating);
  const phi = toPhi(player.deviation);
  const opponentMu = toMu(opponent.rating);
  const opponentPhi = toPhi(opponent.deviation);
  const opponentG = g(opponentPhi);
  const e = expected(mu, opponentMu, opponentPhi);
  const v = 1 / (opponentG * opponentG * e * (1 - e));
  const delta = v * opponentG * (resultScore - e);
  const nextVolatility = calculateNewVolatility(phi, player.volatility, v, delta);
  const phiStar = Math.sqrt(phi * phi + nextVolatility * nextVolatility);
  const nextPhi = 1 / Math.sqrt((1 / (phiStar * phiStar)) + (1 / v));
  const nextMu = mu + (nextPhi * nextPhi * opponentG * (resultScore - e));

  return {
    ...player,
    rating: fromMu(nextMu),
    deviation: fromPhi(nextPhi),
    volatility: nextVolatility,
    ratedGames: player.ratedGames + 1,
    wins: player.wins + (outcome === 'win' ? 1 : 0),
    draws: player.draws + (outcome === 'draw' ? 1 : 0),
    losses: player.losses + (outcome === 'loss' ? 1 : 0),
    lastRatedAt: ratedAt,
    updatedAt: ratedAt
  };
}

export function toDisplayRatingChange(beforeRating: number, afterRating: number): RatingDisplayChange {
  const before = Math.round(beforeRating);
  const after = Math.round(afterRating);
  return { before, after, delta: after - before };
}

export function computeGlicko2PairUpdate(input: Glicko2PairUpdateInput): Glicko2PairUpdateResult {
  const blackScore = scoreFor(input.result, 'black');
  const whiteScore = scoreFor(input.result, 'white');
  const blackOutcome = blackScore === 1 ? 'win' : blackScore === 0.5 ? 'draw' : 'loss';
  const whiteOutcome = whiteScore === 1 ? 'win' : whiteScore === 0.5 ? 'draw' : 'loss';
  const black = updateOne(input.black, input.white, blackScore, input.ratedAt, blackOutcome);
  const white = updateOne(input.white, input.black, whiteScore, input.ratedAt, whiteOutcome);

  return {
    black,
    white,
    blackDisplay: toDisplayRatingChange(input.black.rating, black.rating),
    whiteDisplay: toDisplayRatingChange(input.white.rating, white.rating)
  };
}
```

- [ ] **Step 4: Verify pure calculation tests pass**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\rating.glicko2.test.ts
```

Expected:

```text
PASS test/rating.glicko2.test.ts
```

- [ ] **Step 5: Commit pure rating math**

```powershell
git add shared/glicko2-rating.ts test/rating.glicko2.test.ts
git commit -m "feat: add glicko2 rating math"
```

---

## Task 4: Rating Store Helper

**Files:**
- Create: `workers/match-worker-rating.ts`
- Create: `test/workers.match-rating.test.ts`
- Modify: `workers/match-worker-types.ts`

- [ ] **Step 1: Write storage helper tests**

Create `test/workers.match-rating.test.ts` with these cases:

```ts
import { createMatchWorkerRatingHelpers } from '../workers/match-worker-rating';

describe('match worker rating helpers', () => {
  const nowIso = '2026-06-25T00:00:00.000Z';

  test('applies first rated result to both players from before states', () => {
    const helpers = createMatchWorkerRatingHelpers({ now: () => nowIso });
    const store = helpers.createEmptyStore();

    const result = helpers.applyRatedResult(store, {
      matchId: 'rated-match-1',
      pool: 'card_ranked_v1',
      blackPlayerId: 'black-player',
      whitePlayerId: 'white-player',
      result: 'BLACK_WIN',
      rulesetVersion: 'card-ranked-v1',
      catalogVersion: 'catalog-test'
    });

    expect(result.ok).toBe(true);
    expect(Math.round(result.payload.black.after.rating)).toBe(1662);
    expect(Math.round(result.payload.white.after.rating)).toBe(1338);
    expect(result.store.players['black-player'].wins).toBe(1);
    expect(result.store.players['white-player'].losses).toBe(1);
  });

  test('does not update twice for the same matchId', () => {
    const helpers = createMatchWorkerRatingHelpers({ now: () => nowIso });
    const first = helpers.applyRatedResult(helpers.createEmptyStore(), {
      matchId: 'rated-match-1',
      pool: 'card_ranked_v1',
      blackPlayerId: 'black-player',
      whitePlayerId: 'white-player',
      result: 'BLACK_WIN',
      rulesetVersion: 'card-ranked-v1',
      catalogVersion: 'catalog-test'
    });
    const second = helpers.applyRatedResult(first.store, {
      matchId: 'rated-match-1',
      pool: 'card_ranked_v1',
      blackPlayerId: 'black-player',
      whitePlayerId: 'white-player',
      result: 'WHITE_WIN',
      rulesetVersion: 'card-ranked-v1',
      catalogVersion: 'catalog-test'
    });

    expect(second.ok).toBe(true);
    expect(second.idempotentReplay).toBe(true);
    expect(second.store.players['black-player'].wins).toBe(1);
    expect(second.store.players['black-player'].losses).toBe(0);
  });

  test('NO_CONTEST changes no ratings and creates no match record', () => {
    const helpers = createMatchWorkerRatingHelpers({ now: () => nowIso });
    const store = helpers.createEmptyStore();
    const result = helpers.applyRatedResult(store, {
      matchId: 'rated-match-1',
      pool: 'card_ranked_v1',
      blackPlayerId: 'black-player',
      whitePlayerId: 'white-player',
      result: 'NO_CONTEST',
      rulesetVersion: 'card-ranked-v1',
      catalogVersion: 'catalog-test'
    });

    expect(result.ok).toBe(true);
    expect(Object.keys(result.store.matches)).toHaveLength(0);
    expect(result.store.players['black-player']).toBeUndefined();
  });

  test('leaderboard orders by internal rating then RD then games then playerId', () => {
    const helpers = createMatchWorkerRatingHelpers({ now: () => nowIso });
    let store = helpers.createEmptyStore();
    store = helpers.applyRatedResult(store, {
      matchId: 'm1',
      pool: 'card_ranked_v1',
      blackPlayerId: 'a-player',
      whitePlayerId: 'b-player',
      result: 'BLACK_WIN',
      rulesetVersion: 'card-ranked-v1',
      catalogVersion: 'catalog-test'
    }).store;

    const list = helpers.listLeaderboard(store, { limit: 10 });

    expect(list.entries[0].playerId).toBe('a-player');
    expect(list.entries[0].displayRating).toBe(1662);
    expect(list.entries[0].ratedGames).toBe(1);
  });
});
```

- [ ] **Step 2: Verify helper tests fail**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\workers.match-rating.test.ts
```

Expected:

```text
Cannot find module '../workers/match-worker-rating'
```

- [ ] **Step 3: Implement `workers/match-worker-rating.ts`**

Implement a helper with this public surface:

```ts
import {
  createInitialPlayerRating,
  normalizeRatedPool,
  normalizeRatedResult,
  RATED_POOL_CARD_RANKED_V1,
  RATING_SYSTEM_VERSION,
  PlayerRating,
  RatingMatchRecord
} from '../shared/rating-contract';
import { computeGlicko2PairUpdate } from '../shared/glicko2-rating';
import type { MatchWorkerRatingStore } from './match-worker-types';

type RatingHelpersConfig = { now?: () => string };

type ApplyRatedResultInput = {
  matchId: string;
  pool: string;
  blackPlayerId: string;
  whitePlayerId: string;
  result: 'BLACK_WIN' | 'WHITE_WIN' | 'DRAW' | 'NO_CONTEST';
  rulesetVersion: string;
  catalogVersion: string;
};

function normalizePlayerId(value: unknown): string | null {
  const playerId = String(value || '').trim();
  return /^[A-Za-z0-9_-]{8,80}$/.test(playerId) ? playerId : null;
}

export function createMatchWorkerRatingHelpers(config: RatingHelpersConfig = {}) {
  const now = typeof config.now === 'function' ? config.now : () => new Date().toISOString();

  function createEmptyStore(): MatchWorkerRatingStore {
    return {
      version: RATING_SYSTEM_VERSION,
      pool: RATED_POOL_CARD_RANKED_V1,
      players: {},
      matches: {},
      activeMatches: {},
      updatedAt: now()
    };
  }

  function loadStore(raw: unknown): MatchWorkerRatingStore {
    const empty = createEmptyStore();
    if (!raw || typeof raw !== 'object') return empty;
    const source = raw as Partial<MatchWorkerRatingStore>;
    return {
      version: RATING_SYSTEM_VERSION,
      pool: RATED_POOL_CARD_RANKED_V1,
      players: source.players && typeof source.players === 'object' ? source.players : {},
      matches: source.matches && typeof source.matches === 'object' ? source.matches : {},
      activeMatches: source.activeMatches && typeof source.activeMatches === 'object' ? source.activeMatches : {},
      updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : now()
    };
  }

  function getPlayerRating(storeValue: unknown, playerIdValue: unknown): PlayerRating | null {
    const store = loadStore(storeValue);
    const playerId = normalizePlayerId(playerIdValue);
    if (!playerId) return null;
    return store.players[playerId] || createInitialPlayerRating(playerId, now());
  }

  function applyRatedResult(storeValue: unknown, input: ApplyRatedResultInput): any {
    const store = loadStore(storeValue);
    const matchId = String(input.matchId || '').trim();
    const pool = normalizeRatedPool(input.pool);
    const result = normalizeRatedResult(input.result);
    const blackPlayerId = normalizePlayerId(input.blackPlayerId);
    const whitePlayerId = normalizePlayerId(input.whitePlayerId);
    if (!matchId || !pool || !result || !blackPlayerId || !whitePlayerId || blackPlayerId === whitePlayerId) {
      return { ok: false, reason: 'RATED_RESULT_INVALID', store };
    }
    if (result === 'NO_CONTEST') {
      return { ok: true, noContest: true, store, payload: { ok: true, matchId, result } };
    }
    const existing = store.matches[matchId];
    if (existing) {
      return { ok: true, idempotentReplay: true, store, payload: { ok: true, matchId, record: existing } };
    }

    const ratedAt = now();
    const blackBefore = store.players[blackPlayerId] || createInitialPlayerRating(blackPlayerId, ratedAt);
    const whiteBefore = store.players[whitePlayerId] || createInitialPlayerRating(whitePlayerId, ratedAt);
    const update = computeGlicko2PairUpdate({ black: blackBefore, white: whiteBefore, result, ratedAt });
    const record: RatingMatchRecord = {
      matchId,
      pool,
      systemVersion: RATING_SYSTEM_VERSION,
      blackPlayerId,
      whitePlayerId,
      result,
      blackBeforeRating: blackBefore.rating,
      blackBeforeDeviation: blackBefore.deviation,
      blackBeforeVolatility: blackBefore.volatility,
      blackAfterRating: update.black.rating,
      blackAfterDeviation: update.black.deviation,
      blackAfterVolatility: update.black.volatility,
      whiteBeforeRating: whiteBefore.rating,
      whiteBeforeDeviation: whiteBefore.deviation,
      whiteBeforeVolatility: whiteBefore.volatility,
      whiteAfterRating: update.white.rating,
      whiteAfterDeviation: update.white.deviation,
      whiteAfterVolatility: update.white.volatility,
      rulesetVersion: String(input.rulesetVersion || 'card-ranked-v1'),
      catalogVersion: String(input.catalogVersion || 'unknown'),
      ratedAt
    };

    const nextStore = {
      ...store,
      players: { ...store.players, [blackPlayerId]: update.black, [whitePlayerId]: update.white },
      matches: { ...store.matches, [matchId]: record },
      updatedAt: ratedAt
    };

    return {
      ok: true,
      store: nextStore,
      payload: {
        ok: true,
        matchId,
        result,
        black: { playerId: blackPlayerId, before: blackBefore, after: update.black, display: update.blackDisplay },
        white: { playerId: whitePlayerId, before: whiteBefore, after: update.white, display: update.whiteDisplay },
        record
      }
    };
  }

  function listLeaderboard(storeValue: unknown, options: { limit?: unknown } = {}) {
    const store = loadStore(storeValue);
    const limit = Math.max(1, Math.min(100, Math.trunc(Number(options.limit) || 50)));
    const entries = Object.values(store.players)
      .filter((entry) => entry.ratedGames > 0)
      .sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        if (a.deviation !== b.deviation) return a.deviation - b.deviation;
        if (b.ratedGames !== a.ratedGames) return b.ratedGames - a.ratedGames;
        return a.playerId.localeCompare(b.playerId);
      })
      .slice(0, limit)
      .map((entry, index) => ({
        rank: index + 1,
        playerId: entry.playerId,
        displayRating: Math.round(entry.rating),
        ratedGames: entry.ratedGames,
        wins: entry.wins,
        draws: entry.draws,
        losses: entry.losses,
        updatedAt: entry.updatedAt
      }));
    return { ok: true, pool: RATED_POOL_CARD_RANKED_V1, entries, updatedAt: store.updatedAt };
  }

  return { createEmptyStore, loadStore, getPlayerRating, applyRatedResult, listLeaderboard };
}
```

- [ ] **Step 4: Run rating helper tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\rating.glicko2.test.ts test\workers.match-rating.test.ts
```

Expected:

```text
PASS test/rating.glicko2.test.ts
PASS test/workers.match-rating.test.ts
```

- [ ] **Step 5: Commit rating store helper**

```powershell
git add workers/match-worker-rating.ts test/workers.match-rating.test.ts workers/match-worker-types.ts
git commit -m "feat: add rated rating store"
```

---

## Task 5: Worker Rating Pool Routes

**Files:**
- Modify: `workers/match-worker.ts`
- Modify: `workers/match-worker-api.ts`
- Test: `test/workers.match-rating.test.ts`

- [ ] **Step 1: Add constants and controller wiring**

In `workers/match-worker.ts`, add near the existing special room IDs:

```ts
const RATING_POOL_CARD_RANKED_ROOM_ID = '__rating_pool_card_ranked_v1__';
const RATING_POOL_STORAGE_KEY = 'rating_pool_card_ranked_v1_store_v1';
```

Import the helper:

```ts
import { createMatchWorkerRatingHelpers } from './match-worker-rating';
```

Add an instance member:

```ts
ratingHelpers: ReturnType<typeof createMatchWorkerRatingHelpers> | null;
```

Initialize it in the constructor:

```ts
this.ratingHelpers = null;
```

Add:

```ts
getRatingHelpers(): ReturnType<typeof createMatchWorkerRatingHelpers> {
    if (!this.ratingHelpers) {
        this.ratingHelpers = createMatchWorkerRatingHelpers();
    }
    return this.ratingHelpers;
}
```

- [ ] **Step 2: Add internal storage route handlers**

Add methods to `MatchRoomDurableObject`:

```ts
async readRatingStore(): Promise<unknown> {
    return await this.state.storage.get(RATING_POOL_STORAGE_KEY);
}

async writeRatingStore(store: unknown): Promise<void> {
    await this.state.storage.put(RATING_POOL_STORAGE_KEY, store);
}

async handleRatingMe(urlObj: URL): Promise<Response> {
    const playerId = String(urlObj.searchParams.get('playerId') || '').trim();
    const helpers = this.getRatingHelpers();
    const store = await this.readRatingStore();
    const rating = helpers.getPlayerRating(store, playerId);
    if (!rating) return jsonResponse(403, { ok: false, reason: 'PLAYER_ID_REQUIRED' });
    return jsonResponse(200, { ok: true, pool: 'card_ranked_v1', rating, displayRating: Math.round(rating.rating) });
}

async handleRatingLeaderboard(urlObj: URL): Promise<Response> {
    const limit = urlObj.searchParams.get('limit') || '50';
    const helpers = this.getRatingHelpers();
    const store = await this.readRatingStore();
    return jsonResponse(200, helpers.listLeaderboard(store, { limit }));
}

async handleInternalRatingFinalize(body: Record<string, unknown>): Promise<Response> {
    const helpers = this.getRatingHelpers();
    const currentStore = await this.readRatingStore();
    const result = helpers.applyRatedResult(currentStore, body as any);
    if (!result.ok) return jsonResponse(400, result);
    await this.writeRatingStore(result.store);
    return jsonResponse(200, result.payload);
}
```

- [ ] **Step 3: Route public and internal paths**

In the DO `fetch()` routing:

```ts
if (request.method === 'GET' && pathname === '/api/rating/me') {
    return this.handleRatingMe(urlObj);
}
if (request.method === 'GET' && pathname === '/api/rating/leaderboard') {
    return this.handleRatingLeaderboard(urlObj);
}
if (request.method === 'POST' && pathname === '/internal/rating/finalize') {
    const parsed = await parseJsonBody(request);
    return this.handleInternalRatingFinalize(parsed || {});
}
```

In the top-level Worker fetch, route `/api/rating/` to `RATING_POOL_CARD_RANKED_ROOM_ID` through the existing `getRoomStub()` pattern.

- [ ] **Step 4: Add API helper in `workers/match-worker-api.ts`**

Add to the config:

```ts
ratingPoolRoomId: string;
```

Add:

```ts
export function getRatingPoolStub(env: MatchWorkerEnv, cfg: MatchWorkerApiConfig) {
    return getRoomStub(env, cfg.ratingPoolRoomId);
}
```

- [ ] **Step 5: Add route tests**

Extend `test/workers.match-rating.test.ts` with:

```ts
test('rating me returns initial 1500 for unrated player', async () => {
  const response = await worker.fetch(new Request('https://example.test/api/rating/me?playerId=player_12345678'), env);
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.displayRating).toBe(1500);
  expect(body.rating.ratedGames).toBe(0);
});
```

- [ ] **Step 6: Run Worker rating tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\workers.match-rating.test.ts
```

Expected:

```text
PASS test/workers.match-rating.test.ts
```

- [ ] **Step 7: Commit Worker routes**

```powershell
git add workers/match-worker.ts workers/match-worker-api.ts test/workers.match-rating.test.ts
git commit -m "feat: expose rated rating routes"
```

---

## Task 6: Rated Queue Match Metadata And Active Lock

**Files:**
- Modify: `shared/rated-matchmaking.ts`
- Modify: `workers/match-worker.ts`
- Modify: `scripts/local-match-server.ts`
- Test: `test/workers.match-rated-queue.test.ts`
- Test: `test/local-match-server.rated-queue.test.ts`

- [ ] **Step 1: Add `matchId` to queue match payload**

In `shared/rated-matchmaking.ts`, add:

```ts
function createRatedMatchId(nowValue?: unknown, blackPlayerIdValue?: unknown, whitePlayerIdValue?: unknown): string {
  const nowMs = toFiniteInteger(nowValue, Date.now());
  const black = normalizePlayerId(blackPlayerIdValue).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16);
  const white = normalizePlayerId(whitePlayerIdValue).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16);
  const random = Math.random().toString(36).slice(2, 10);
  return `rated_${nowMs}_${black}_${white}_${random}`;
}
```

Export it from `RatedMatchmaking`.

- [ ] **Step 2: Store match metadata when creating a rated room**

In `createRatedRoomForPair()` in `workers/match-worker.ts`, generate:

```ts
const matchId = RatedMatchmaking.createRatedMatchId(Date.now(), blackEntry.playerId, whiteEntry.playerId);
```

Set room metadata:

```ts
ratedMatch: {
    enabled: true,
    pool: 'card_ranked_v1',
    systemVersion: 1,
    matchId,
    startedAt: new Date().toISOString(),
    finalizedAt: '',
    finalResult: '',
    ratingStatus: 'pending'
}
```

Include `matchId`, `pool`, and `systemVersion` in both players' matched response payloads.

- [ ] **Step 3: Add active rated lock to rating pool helper**

Extend `workers/match-worker-rating.ts`:

```ts
function claimActiveRatedMatch(storeValue: unknown, input: { matchId: string; roomId: string; blackPlayerId: string; whitePlayerId: string; startedAt: string }) {
  const store = loadStore(storeValue);
  const playerIds = [input.blackPlayerId, input.whitePlayerId];
  const occupied = playerIds.find((playerId) => store.activeMatches[playerId] && store.activeMatches[playerId].matchId !== input.matchId);
  if (occupied) return { ok: false, reason: 'PLAYER_ALREADY_IN_RATED_MATCH', playerId: occupied, store };
  const active = {
    matchId: input.matchId,
    pool: RATED_POOL_CARD_RANKED_V1,
    roomId: input.roomId,
    playerIds,
    startedAt: input.startedAt
  };
  return {
    ok: true,
    store: {
      ...store,
      activeMatches: {
        ...store.activeMatches,
        [input.blackPlayerId]: active,
        [input.whitePlayerId]: active
      },
      updatedAt: now()
    }
  };
}

function releaseActiveRatedMatch(storeValue: unknown, matchId: string) {
  const store = loadStore(storeValue);
  const activeMatches = { ...store.activeMatches };
  Object.keys(activeMatches).forEach((playerId) => {
    if (activeMatches[playerId] && activeMatches[playerId].matchId === matchId) delete activeMatches[playerId];
  });
  return { ok: true, store: { ...store, activeMatches, updatedAt: now() } };
}
```

- [ ] **Step 4: Claim the lock before writing matched queue entries**

When `handleRatedQueueEnter()` finds a candidate and `createRatedRoomForPair()` succeeds, call the rating pool internal claim route before writing matched entries. If claim fails, delete the created room if the repo already has a safe room deletion path; if no deletion path exists, mark the queue request as rejected and do not return matched payload.

Use response reason:

```ts
PLAYER_ALREADY_IN_RATED_MATCH
```

- [ ] **Step 5: Mirror local server queue behavior**

In `scripts/local-match-server.ts`, add the same `matchId`, pool metadata, and duplicate active-player rejection for local queue tests.

- [ ] **Step 6: Add queue tests**

Extend `test/workers.match-rated-queue.test.ts` and `test/local-match-server.rated-queue.test.ts`:

```ts
expect(matched.match.payload.ratedMatch.matchId).toMatch(/^rated_/);
expect(matched.match.payload.ratedMatch.pool).toBe('card_ranked_v1');
expect(matched.match.payload.ratedMatch.systemVersion).toBe(1);
```

Add a duplicate active-player case:

```ts
expect(secondQueueBody.ok).toBe(false);
expect(secondQueueBody.reason).toBe('PLAYER_ALREADY_IN_RATED_MATCH');
```

- [ ] **Step 7: Run queue tests**

```powershell
npx jest --runInBand --runTestsByPath test\workers.match-rated-queue.test.ts test\local-match-server.rated-queue.test.ts
```

Expected:

```text
PASS test/workers.match-rated-queue.test.ts
PASS test/local-match-server.rated-queue.test.ts
```

- [ ] **Step 8: Commit queue metadata and active lock**

```powershell
git add shared/rated-matchmaking.ts workers/match-worker.ts scripts/local-match-server.ts test/workers.match-rated-queue.test.ts test/local-match-server.rated-queue.test.ts
git commit -m "feat: add rated match ids and active locks"
```

---

## Task 7: Finalize Rating From Server-Authoritative Result

**Files:**
- Modify: `workers/match-worker.ts`
- Create: `test/workers.match-rated-result.test.ts`

- [ ] **Step 1: Add final result extraction helper**

In `workers/match-worker.ts`, add near other room helpers:

```ts
function extractRatedResultFromGameState(gameStateValue: unknown): 'BLACK_WIN' | 'WHITE_WIN' | 'DRAW' | null {
    const gameState = asRecord(gameStateValue);
    const board = Array.isArray(gameState.board) ? gameState.board : [];
    let black = 0;
    let white = 0;
    board.forEach((row) => {
        if (!Array.isArray(row)) return;
        row.forEach((cell) => {
            const value = String(cell || '').toUpperCase();
            if (value === 'B' || value === 'BLACK') black += 1;
            if (value === 'W' || value === 'WHITE') white += 1;
        });
    });
    if (black > white) return 'BLACK_WIN';
    if (white > black) return 'WHITE_WIN';
    return 'DRAW';
}
```

If the repo already exposes a shared canonical result helper, replace this helper with that import instead of duplicating board interpretation.

- [ ] **Step 2: Add `finalizeRatedMatchIfNeeded()`**

Add a method to `MatchRoomDurableObject`:

```ts
async finalizeRatedMatchIfNeeded(result: 'BLACK_WIN' | 'WHITE_WIN' | 'DRAW' | 'NO_CONTEST', reason: string): Promise<Record<string, unknown> | null> {
    if (!this.room || !isRatedRoomRecord(this.room)) return null;
    const ratedMatch = asRecord(this.room.ratedMatch);
    const matchId = String(ratedMatch.matchId || '').trim();
    if (!matchId || ratedMatch.ratingStatus === 'applied') return asRecord(ratedMatch.ratingResult) || null;
    const seatPlayerIds = asRecord(asRecord(this.room.publicSeatState).seatPlayerIds);
    const blackPlayerId = String(seatPlayerIds.black || '').trim();
    const whitePlayerId = String(seatPlayerIds.white || '').trim();
    if (!blackPlayerId || !whitePlayerId) return null;

    const payload = {
        matchId,
        pool: 'card_ranked_v1',
        blackPlayerId,
        whitePlayerId,
        result,
        rulesetVersion: 'card-ranked-v1',
        catalogVersion: 'catalog-current'
    };
    const response = await this.fetchRatingPool('/internal/rating/finalize', payload);
    const body = await response.json() as Record<string, unknown>;
    if (!response.ok || body.ok === false) {
        this.room.ratedMatch = { ...ratedMatch, ratingStatus: 'failed', ratingError: body.reason || 'RATING_FINALIZE_FAILED' };
        await this.persistRoom();
        return null;
    }
    this.room.ratedMatch = {
        ...ratedMatch,
        finalResult: result,
        finalReason: reason,
        finalizedAt: new Date().toISOString(),
        ratingStatus: result === 'NO_CONTEST' ? 'no_contest' : 'applied',
        ratingResult: body
    };
    await this.persistRoom();
    return body;
}
```

Use the existing `saveRoom()` method for room persistence.

- [ ] **Step 3: Call finalization after normal game over**

In `handlePublish()` after the server applies a move and confirms game over with canonical game logic, call:

```ts
const ratedResult = extractRatedResultFromGameState(this.room.snapshot && asRecord(this.room.snapshot).gameState);
if (ratedResult) {
    await this.finalizeRatedMatchIfNeeded(ratedResult, 'normal_end');
}
```

Ensure this call happens after server state is persisted and before the snapshot response is sent or broadcast, so clients receive `ratedMatch.ratingResult`.

- [ ] **Step 4: Include rating result in public snapshot**

Where public room/snapshot payload is prepared, include a sanitized field:

```ts
ratedMatch: {
    enabled: true,
    pool,
    matchId,
    ratingStatus,
    finalResult,
    finalizedAt,
    ratingResult
}
```

Do not include RD or volatility in the public payload. Include `before`, `after`, and `delta` display values for both seats.

- [ ] **Step 5: Release active match after finalization**

After `handleInternalRatingFinalize()` stores the match record, call `releaseActiveRatedMatch()` in the rating pool store. Duplicate finalization must return the original match record and leave the active lock released.

- [ ] **Step 6: Add Worker result tests**

Create `test/workers.match-rated-result.test.ts`:

```ts
import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const RESULT_MARKER = '__RATED_RESULT_WORKER_RESULT__';

function runRatedResultScenario(runnerSource: string) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'rated result worker runner failed');
  }
  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) throw new Error(output || 'rated result marker missing');
  return JSON.parse(output.slice(markerIndex + RESULT_MARKER.length));
}

function runDirectFinalizeScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  function makeState() {",
    "    const storage = new Map();",
    "    return { storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async (value) => storage.set('__alarm__', value), deleteAlarm: async () => storage.delete('__alarm__') } };",
    "  }",
    "  let ratingPool = null;",
    "  const env = { MATCH_ROOM: { idFromName: (name) => String(name), get: (id) => ({ fetch: async (request) => ratingPool.fetch(request) }) } };",
    "  ratingPool = new MatchRoomDurableObject(makeState(), env);",
    "  const room = new MatchRoomDurableObject(makeState(), env);",
    "  room.room = {",
    "    roomId: 'RATED1',",
    "    matchType: 'rated',",
    "    ratedMatch: { enabled: true, pool: 'card_ranked_v1', systemVersion: 1, matchId: 'rated_direct_1', ratingStatus: 'pending' },",
    "    publicSeatState: { seatPlayerIds: { black: 'black_12345678', white: 'white_12345678' } },",
    "    snapshot: { gameState: { board: Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, col) => (row * 8 + col < 33 ? 'BLACK' : 'WHITE'))) } }",
    "  };",
    "  await room.saveRoom();",
    "  const first = await room.finalizeRatedMatchIfNeeded('BLACK_WIN', 'normal_end');",
    "  const second = await room.finalizeRatedMatchIfNeeded('BLACK_WIN', 'normal_end');",
    "  const blackResponse = await ratingPool.fetch(new Request('https://rating/api/rating/me?playerId=black_12345678'));",
    "  const whiteResponse = await ratingPool.fetch(new Request('https://rating/api/rating/me?playerId=white_12345678'));",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({ first, second, black: await blackResponse.json(), white: await whiteResponse.json(), ratedMatch: room.room.ratedMatch }));`,
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
  ].join('\n');
  return runRatedResultScenario(runner);
}

function runCasualFinalizeScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const storage = new Map();",
    "  const makeState = () => ({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "  let ratingPool = null;",
    "  const env = { MATCH_ROOM: { idFromName: (name) => String(name), get: (id) => ({ fetch: async (request) => ratingPool.fetch(request) }) } };",
    "  ratingPool = new MatchRoomDurableObject(makeState(), env);",
    "  const room = new MatchRoomDurableObject(makeState(), env);",
    "  room.room = { roomId: 'CASUAL1', matchType: '', publicSeatState: { seatPlayerIds: { black: 'black_12345678', white: 'white_12345678' } } };",
    "  const finalizeResult = await room.finalizeRatedMatchIfNeeded('BLACK_WIN', 'normal_end');",
    "  const blackResponse = await ratingPool.fetch(new Request('https://rating/api/rating/me?playerId=black_12345678'));",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({ finalizeResult, black: await blackResponse.json() }));`,
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
  ].join('\n');
  return runRatedResultScenario(runner);
}

describe('rated match result finalization', () => {
  test('normal rated game over updates both ratings once', () => {
    const result = runDirectFinalizeScenario();

    expect(result.first.ok).toBe(true);
    expect(result.ratedMatch.ratingStatus).toBe('applied');
    expect(result.ratedMatch.finalResult).toBe('BLACK_WIN');
    expect(result.black.rating.ratedGames).toBe(1);
    expect(result.white.rating.ratedGames).toBe(1);
    expect(result.black.displayRating).toBe(1662);
    expect(result.white.displayRating).toBe(1338);
  });

  test('casual network game over does not update rating', () => {
    const result = runCasualFinalizeScenario();

    expect(result.finalizeResult).toBe(null);
    expect(result.black.rating.ratedGames).toBe(0);
    expect(result.black.displayRating).toBe(1500);
  });

  test('replayed finalization does not double update rating', () => {
    const result = runDirectFinalizeScenario();

    expect(result.second.ok).toBe(true);
    expect(result.black.rating.ratedGames).toBe(1);
    expect(result.white.rating.ratedGames).toBe(1);
  });
});
```

- [ ] **Step 7: Run result tests**

```powershell
npx jest --runInBand --runTestsByPath test\workers.match-rated-result.test.ts test\workers.match-publish-idempotency.test.ts
```

Expected:

```text
PASS test/workers.match-rated-result.test.ts
PASS test/workers.match-publish-idempotency.test.ts
```

- [ ] **Step 8: Commit result finalization**

```powershell
git add workers/match-worker.ts test/workers.match-rated-result.test.ts
git commit -m "feat: finalize rated match results"
```

---

## Task 8: Disconnect Loss, Resign, And No Contest

**Files:**
- Modify: `workers/match-worker.ts`
- Test: `test/workers.match-rated-result.test.ts`
- Test: `test/workers.match-stream-sse.test.ts`

- [ ] **Step 1: Add disconnect tracking fields**

Add to rated room state:

```ts
ratedPresence: {
    blackDisconnectedAt: 0,
    whiteDisconnectedAt: 0,
    disconnectGraceMs: 120000
}
```

Use `120000` ms as the first production value. This is long enough for accidental refresh/reconnect, short enough to prevent a lost game from being held for 10 minutes.

- [ ] **Step 2: Mark seat disconnects on stream close or explicit leave**

When an authenticated black/white SSE stream closes, update only that seat:

```ts
if (isRatedRoomRecord(this.room) && viewer.seatKey === 'black') {
    this.room.ratedPresence.blackDisconnectedAt = Date.now();
}
if (isRatedRoomRecord(this.room) && viewer.seatKey === 'white') {
    this.room.ratedPresence.whiteDisconnectedAt = Date.now();
}
```

When the same seat reconnects, clear its disconnected timestamp.

- [ ] **Step 3: Add explicit resign route**

Add:

```ts
if (request.method === 'POST' && pathname === '/api/match/resign') {
    const parsed = await parseJsonBody(request);
    return this.handleResign(parsed || {});
}
```

Implement:

```ts
async handleResign(body: Record<string, unknown>): Promise<Response> {
    const seatKey = this.authenticateSeat(body);
    if (!seatKey) return jsonResponse(403, { ok: false, reason: 'SEAT_TOKEN_INVALID' });
    if (!isRatedRoomRecord(this.room)) return jsonResponse(400, { ok: false, reason: 'RESIGN_RATED_ONLY_INITIAL' });
    const result = seatKey === 'black' ? 'WHITE_WIN' : 'BLACK_WIN';
    const ratingResult = await this.finalizeRatedMatchIfNeeded(result, 'resign');
    await this.broadcastSnapshot('rated_resign');
    return jsonResponse(200, { ok: true, result, ratingResult });
}
```

Use the repo's existing seat authentication method name instead of `authenticateSeat` if it differs.

- [ ] **Step 4: Add alarm-based disconnect finalization**

In the DO alarm handler, call:

```ts
await this.finalizeRatedDisconnectIfExpired(Date.now());
```

Implement:

```ts
async finalizeRatedDisconnectIfExpired(nowMs: number): Promise<boolean> {
    if (!this.room || !isRatedRoomRecord(this.room)) return false;
    const ratedMatch = asRecord(this.room.ratedMatch);
    if (ratedMatch.ratingStatus === 'applied' || ratedMatch.ratingStatus === 'no_contest') return false;
    const presence = asRecord(this.room.ratedPresence);
    const graceMs = Number(presence.disconnectGraceMs) || 120000;
    const blackAt = Number(presence.blackDisconnectedAt) || 0;
    const whiteAt = Number(presence.whiteDisconnectedAt) || 0;
    const blackExpired = blackAt > 0 && nowMs - blackAt >= graceMs;
    const whiteExpired = whiteAt > 0 && nowMs - whiteAt >= graceMs;
    if (blackExpired && !whiteExpired) {
        await this.finalizeRatedMatchIfNeeded('WHITE_WIN', 'black_disconnect');
        await this.broadcastSnapshot('rated_disconnect_loss');
        return true;
    }
    if (whiteExpired && !blackExpired) {
        await this.finalizeRatedMatchIfNeeded('BLACK_WIN', 'white_disconnect');
        await this.broadcastSnapshot('rated_disconnect_loss');
        return true;
    }
    if (blackExpired && whiteExpired) {
        await this.finalizeRatedMatchIfNeeded('NO_CONTEST', 'both_disconnected');
        await this.broadcastSnapshot('rated_no_contest');
        return true;
    }
    return false;
}
```

- [ ] **Step 5: Add tests**

Add to `test/workers.match-rated-result.test.ts`:

```ts
function runDisconnectOrResignScenario(mode: 'resign' | 'black_disconnect' | 'both_disconnect') {
  const runner = [
    "(async () => {",
    "  const mode = process.argv[2];",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  function makeState() {",
    "    const storage = new Map();",
    "    return { storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async (value) => storage.set('__alarm__', value), deleteAlarm: async () => storage.delete('__alarm__') } };",
    "  }",
    "  let ratingPool = null;",
    "  const env = { MATCH_ROOM: { idFromName: (name) => String(name), get: (id) => ({ fetch: async (request) => ratingPool.fetch(request) }) } };",
    "  ratingPool = new MatchRoomDurableObject(makeState(), env);",
    "  const room = new MatchRoomDurableObject(makeState(), env);",
    "  room.room = {",
    "    roomId: 'RATED_DISC1',",
    "    matchType: 'rated',",
    "    ratedMatch: { enabled: true, pool: 'card_ranked_v1', systemVersion: 1, matchId: 'rated_disconnect_1_' + mode, ratingStatus: 'pending' },",
    "    ratedPresence: { blackDisconnectedAt: 0, whiteDisconnectedAt: 0, disconnectGraceMs: 120000 },",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    publicSeatState: { seatPlayerIds: { black: 'black_12345678', white: 'white_12345678' } }",
    "  };",
    "  let actionResult = null;",
    "  if (mode === 'resign') {",
    "    const response = await room.handleResign({ seatKey: 'black', seatToken: 'token_black' });",
    "    actionResult = await response.json();",
    "  } else if (mode === 'black_disconnect') {",
    "    room.room.ratedPresence.blackDisconnectedAt = 1;",
    "    actionResult = await room.finalizeRatedDisconnectIfExpired(120001);",
    "  } else {",
    "    room.room.ratedPresence.blackDisconnectedAt = 1;",
    "    room.room.ratedPresence.whiteDisconnectedAt = 1;",
    "    actionResult = await room.finalizeRatedDisconnectIfExpired(120001);",
    "  }",
    "  const blackResponse = await ratingPool.fetch(new Request('https://rating/api/rating/me?playerId=black_12345678'));",
    "  const whiteResponse = await ratingPool.fetch(new Request('https://rating/api/rating/me?playerId=white_12345678'));",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({ actionResult, ratedMatch: room.room.ratedMatch, black: await blackResponse.json(), white: await whiteResponse.json() }));`,
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
  ].join('\n');
  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath, mode], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'disconnect scenario failed');
  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) throw new Error(output || 'disconnect marker missing');
  return JSON.parse(output.slice(markerIndex + RESULT_MARKER.length));
}

test('explicit resign counts as a rated loss', () => {
  const result = runDisconnectOrResignScenario('resign');

  expect(result.actionResult.ok).toBe(true);
  expect(result.ratedMatch.finalResult).toBe('WHITE_WIN');
  expect(result.black.displayRating).toBe(1338);
  expect(result.white.displayRating).toBe(1662);
});

test('single-player disconnect beyond grace counts as a rated loss', () => {
  const result = runDisconnectOrResignScenario('black_disconnect');

  expect(result.actionResult).toBe(true);
  expect(result.ratedMatch.finalResult).toBe('WHITE_WIN');
  expect(result.black.rating.ratedGames).toBe(1);
  expect(result.white.rating.ratedGames).toBe(1);
});

test('both players disconnected beyond grace is no contest', () => {
  const result = runDisconnectOrResignScenario('both_disconnect');

  expect(result.actionResult).toBe(true);
  expect(result.ratedMatch.ratingStatus).toBe('no_contest');
  expect(result.black.rating.ratedGames).toBe(0);
  expect(result.white.rating.ratedGames).toBe(0);
});
```

- [ ] **Step 6: Run disconnect tests**

```powershell
npx jest --runInBand --runTestsByPath test\workers.match-rated-result.test.ts test\workers.match-stream-sse.test.ts
```

Expected:

```text
PASS test/workers.match-rated-result.test.ts
PASS test/workers.match-stream-sse.test.ts
```

- [ ] **Step 7: Commit disconnect handling**

```powershell
git add workers/match-worker.ts test/workers.match-rated-result.test.ts test/workers.match-stream-sse.test.ts
git commit -m "feat: add rated disconnect losses"
```

---

## Task 9: Browser UI For Rating And Rated Ranking

**Files:**
- Modify: `ui/network-client.ts`
- Modify: `ui/handlers/match-mode/rated-match.ts`
- Modify: `ui/handlers/match-mode/leaderboard-controller.ts`
- Modify: `styles-leaderboard.css`
- Test: `test/ui.match-mode.network-button.test.ts`
- Test: `test/ui.leaderboard-client.test.ts`

- [ ] **Step 1: Add network client methods**

In `ui/network-client.ts`, add:

```ts
async getMyRating(playerId: string): Promise<Record<string, unknown>> {
    const normalizedPlayerId = String(playerId || '').trim();
    const response = await fetch(`/api/rating/me?playerId=${encodeURIComponent(normalizedPlayerId)}`, {
        method: 'GET',
        cache: 'no-store'
    });
    return await response.json();
}

async getRatedLeaderboard(limit = 50): Promise<Record<string, unknown>> {
    const response = await fetch(`/api/rating/leaderboard?pool=card_ranked_v1&limit=${encodeURIComponent(String(limit))}`, {
        method: 'GET',
        cache: 'no-store'
    });
    return await response.json();
}
```

- [ ] **Step 2: Show current rating in rated queue panel**

In `ui/handlers/match-mode/rated-match.ts`, when opening the panel:

```ts
const rating = await networkClient.getMyRating(playerId);
ratingValueNode.textContent = rating && rating.displayRating ? String(rating.displayRating) : '1500';
ratingGamesNode.textContent = rating && rating.rating && Number(rating.rating.ratedGames) > 0
    ? `${Number(rating.rating.ratedGames)}戦`
    : '未対戦';
```

Do not show RD or volatility.

- [ ] **Step 3: Render rating result after rated match finalization**

Where network snapshots are applied, read:

```ts
snapshot.ratedMatch.ratingResult
```

Render:

```text
レート 1500 → 1662（+162）
```

Use the viewer's seat to choose black or white display change. If `ratingStatus` is `failed`, show:

```text
レート更新を確認中
```

and refresh `/api/rating/me` after the result overlay is shown.

- [ ] **Step 4: Add separate rated ranking view**

In `leaderboard-controller.ts`, add a `rated` category key separate from existing `score`, `timeAttack`, `timeDefense`, and `shortestTurns`. Fetch from `getRatedLeaderboard()`. Render columns:

```text
順位 / プレイヤー名 / レート / 対戦数 / 勝 / 分 / 敗
```

Keep playerId displayed next to player name using the existing playerId presentation pattern from the current ranking.

- [ ] **Step 5: Add UI tests**

Extend `test/ui.leaderboard-client.test.ts`:

```ts
test('fetches rated leaderboard from rating endpoint', async () => {
  fetchMock.mockResponseOnce(JSON.stringify({ ok: true, entries: [] }));
  await client.getRatedLeaderboard(25);

  expect(fetchMock).toHaveBeenCalledWith('/api/rating/leaderboard?pool=card_ranked_v1&limit=25', expect.objectContaining({ method: 'GET' }));
});
```

Extend `test/ui.match-mode.network-button.test.ts`:

```ts
expect(ratedPanel.textContent).toContain('1500');
expect(ratedPanel.textContent).not.toContain('RD');
expect(ratedPanel.textContent).not.toContain('volatility');
```

- [ ] **Step 6: Run UI tests**

```powershell
npx jest --runInBand --runTestsByPath test\ui.leaderboard-client.test.ts test\ui.match-mode.network-button.test.ts
```

Expected:

```text
PASS test/ui.leaderboard-client.test.ts
PASS test/ui.match-mode.network-button.test.ts
```

- [ ] **Step 7: Commit UI changes**

```powershell
git add ui/network-client.ts ui/handlers/match-mode/rated-match.ts ui/handlers/match-mode/leaderboard-controller.ts styles-leaderboard.css test/ui.leaderboard-client.test.ts test/ui.match-mode.network-button.test.ts
git commit -m "feat: show rated ratings in ui"
```

---

## Task 10: Worker Mirror And Full Verification

**Files:**
- Modify generated/mirror files through scripts only.

- [ ] **Step 1: Prepare Worker assets**

Run:

```powershell
npm run worker:prepare
```

Expected:

```text
> ... worker:prepare
```

Exit code must be `0`. This may update `worker-public/` and `public/module-registry.js`.

- [ ] **Step 2: Run focused suites**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\rating.glicko2.test.ts test\workers.match-rating.test.ts test\workers.match-rated-queue.test.ts test\workers.match-rated-result.test.ts test\local-match-server.rated-queue.test.ts test\ui.leaderboard-client.test.ts test\ui.match-mode.network-button.test.ts
```

Expected:

```text
PASS test/rating.glicko2.test.ts
PASS test/workers.match-rating.test.ts
PASS test/workers.match-rated-queue.test.ts
PASS test/workers.match-rated-result.test.ts
PASS test/local-match-server.rated-queue.test.ts
PASS test/ui.leaderboard-client.test.ts
PASS test/ui.match-mode.network-button.test.ts
```

- [ ] **Step 3: Run contract verification**

Run:

```powershell
npm run build:ts
npm run test:network:parity
npm run match:check
```

Expected: all exit code `0`. If Jest reports the existing open-handle warning after a passing suite, record it as an existing test harness warning, not a failure.

- [ ] **Step 4: Inspect diffs**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors. Dirty files should be exactly the implementation files, generated mirror outputs from `worker:prepare`, and no unrelated screenshot or temporary files.

- [ ] **Step 5: Commit final generated sync**

```powershell
git add public/module-registry.js public/module-registry.optional.js worker-public shared workers ui scripts test 01-rulebook.md docs/architecture-contracts.md styles-leaderboard.css
git commit -m "feat: add rated glicko2 system"
```

Before this command, inspect `git status --short`. Do not include unrelated `.codex-podium-*` files or unrelated user work.

---

## Self-Review

- Spec coverage: queue, 10-minute timeout, auto matching, playerId requirement, Glicko-2 values, one-match rating period, no provisional state, simultaneous update, matchId idempotency, no score ranking mixing, rated leaderboard, disconnect loss, resign, NO_CONTEST, and required tests are covered by Tasks 1-10.
- Architecture: rating math is pure shared code; rating storage is server-side only; client-submitted rating values are ignored; existing Worker/local queue behavior remains aligned.
- Risk: `extractRatedResultFromGameState()` must use an existing canonical result helper if one is present. This prevents board encoding drift.
- Rollout order: ship Tasks 1-5 first if a smaller milestone is needed. Tasks 6-10 complete the actual rated-result system and should be deployed together.
