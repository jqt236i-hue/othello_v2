# All CPU Level 6 Card Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every CPU level use the Lv6-equivalent policy for card use, hand destroy, and pending target decisions while preserving normal placement level behavior.

**Architecture:** Add a card-policy-level resolver at the CPU decision boundary and route only card-related level inputs through it. Keep display/logging and normal move selection on the existing decision level. Update the rulebook to state the new player-visible CPU card behavior.

**Tech Stack:** TypeScript/CommonJS, Jest via `ts-jest`, existing CPU policy modules under `game/`.

---

### Task 1: Red Tests For Card Policy Level Routing

**Files:**
- Modify: `test/cpu.decision.refactor.test.ts`

- [ ] **Step 1: Add failing tests**

Add tests to `test/cpu.decision.refactor.test.ts` inside the existing `describe('cpu decision refactor helpers', () => { ... })` block:

```typescript
  test('selectCardToUse evaluates low-level CPU card context as Lv6 policy', () => {
    global.AISystem = null;
    global.cpuSmartness.white = 1;
    global.gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: -1
    };
    global.getLegalMoves = () => [{ row: 2, col: 3, flips: [{ row: 3, col: 3 }] }];
    global.cardState = {
      hands: { white: ['guard_01'], black: [] },
      pendingEffectByPlayer: { white: null, black: null },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      hasDestroyedCardThisTurnByPlayer: { white: false, black: false },
      charge: { white: 12, black: 10 },
      boardBonusByCell: {},
      boardBonusConsumedByCell: {}
    };
    global.CardLogic = {
      getUsableCardIds: () => ['guard_01'],
      canUseCard: () => true,
      getCardDef: () => ({ id: 'guard_01', name: '守る意志', type: 'GUARD_WILL' }),
      getCardCost: () => 2
    };
    jest.spyOn(cpuPolicyCore, 'chooseCardWithRiskProfile').mockImplementation((_usable, _getCost, _getDef, context) => {
      expect(context).toEqual(expect.objectContaining({ level: 6, legalMovesCount: 1 }));
      return { cardId: 'guard_01', cardDef: { id: 'guard_01', name: '守る意志', type: 'GUARD_WILL' } };
    });

    const res = cpuDecision.selectCardToUse('white');

    expect(res).toMatchObject({ cardId: 'guard_01' });
  });

  test('low-level CPU hand destroy enters Lv6 card policy cycle', () => {
    global.cpuSmartness.white = 1;
    global.gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: -1
    };
    global.getLegalMoves = () => [{ row: 2, col: 3, flips: [{ row: 3, col: 3 }] }];
    global.cardState = {
      hands: { white: ['risky_01', 'keep_01'], black: [] },
      pendingEffectByPlayer: { white: null, black: null },
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      hasDestroyedCardThisTurnByPlayer: { white: false, black: false },
      charge: { white: 14, black: 10 },
      boardBonusByCell: {},
      boardBonusConsumedByCell: {}
    };
    global.CardLogic = {
      getUsableCardIds: () => ['keep_01'],
      getCardDef: (id) => ({ id, name: id, type: id === 'risky_01' ? 'TIME_BOMB' : 'GUARD_WILL' }),
      getCardCost: (id) => (id === 'risky_01' ? 10 : 2)
    };
    jest.spyOn(cpuPolicyCore, 'chooseHandDestroyTargetForCycle').mockImplementation((_hand, _usable, _getCost, _getDef, context) => {
      expect(context).toEqual(expect.objectContaining({ level: 6, legalMovesCount: 1 }));
      return { cardId: 'risky_01', reason: 'test_low_level_policy' };
    });

    const res = cpuDecision.selectHandCardToDestroy('white');

    expect(res).toMatchObject({ cardId: 'risky_01' });
  });

  test('low-level CPU pending target selection uses Lv6 ONNX-capable policy gate', async () => {
    global.cpuSmartness.white = 1;
    global.gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: -1
    };
    global.gameState.board[3][2] = 1;
    global.gameState.board[3][5] = 1;
    global.cardState.pendingEffectByPlayer.white = { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' };
    global.CpuPolicyOnnxRuntime = {
      choosePendingTarget: jest.fn(async (targets) => targets[1]),
      evaluatePosition: jest.fn(async () => 0)
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        nextCardState: {
          ...global.cardState,
          pendingEffectByPlayer: { ...global.cardState.pendingEffectByPlayer, white: null }
        },
        nextGameState: global.gameState,
        playbackEvents: []
      }))
    };

    await cpuDecision.cpuSelectDestroyWithPolicy('white');

    expect(global.CpuPolicyOnnxRuntime.choosePendingTarget).toHaveBeenCalled();
  });

  test('selectCpuMoveWithPolicy keeps low-level placement policy level unchanged', () => {
    global.cpuSmartness.white = 3;
    global.gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: -1
    };
    const candidateMoves = [
      { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
      { row: 4, col: 5, flips: [{ row: 4, col: 4 }] }
    ];
    jest.spyOn(cpuPolicyCore, 'chooseMove').mockImplementation((moves, level) => {
      expect(level).toBe(3);
      return moves[0];
    });

    const res = cpuDecision.selectCpuMoveWithPolicy(candidateMoves, 'white');

    expect(res).toBe(candidateMoves[0]);
  });
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/cpu.decision.refactor.test.ts
```

Expected: at least one of the new tests fails because current low-level card paths still use level `1`.

### Task 2: Add Card Policy Level Resolver

**Files:**
- Modify: `game/cpu-decision.ts`

- [ ] **Step 1: Implement resolver**

Add these helpers near `resolveCpuDecisionLevelForPlayer`:

```typescript
function resolveCpuCardPolicyLevelValue(value: any): number {
    const decisionLevel = resolveCpuDecisionLevelValue(value);
    if (decisionLevel !== null) return Math.max(6, decisionLevel);
    return 6;
}

function resolveCpuCardPolicyLevelForPlayer(playerKey: any): number {
    try {
        const runtime = getCpuDecisionRuntime();
        if (runtime && typeof runtime.readCpuSmartness === 'function') {
            const profileValues = runtime.readCpuSmartness();
            const profileValue = profileValues && profileValues[playerKey];
            return resolveCpuCardPolicyLevelValue(profileValue);
        }
    } catch (e) { /* ignore and fall back to legacy globals */ }
    const profileValues = (typeof cpuSmartness !== 'undefined' ? cpuSmartness : null);
    if (profileValues) return resolveCpuCardPolicyLevelValue(profileValues[playerKey]);
    return 6;
}

function resolveCpuCardPolicyLevelFromLevel(level: any): number {
    return resolveCpuCardPolicyLevelValue(level);
}
```

- [ ] **Step 2: Route card-only paths through resolver**

Change CPU decision wiring:

```typescript
resolveCpuSmartnessLevel: (playerKey: any) => resolveCpuCardPolicyLevelForPlayer(playerKey),
readCardUseDisplayLevel: (playerKey: any) => resolveCpuDecisionLevelForPlayer(playerKey),
```

Use the policy resolver for:

```typescript
const policyLevel = resolveCpuCardPolicyLevelFromLevel(level);
```

inside `buildCardQuiescenceSnapshot`, `shouldHoldCardByQuiescence`, `isCardChoiceAllowedByRisk`, `isCardChoiceAllowedByHighConfidence`, `buildPendingTargetOnnxContext`, `evaluatePendingTargetValue`, `rerankOnnxPendingTargetChoice`, `choosePendingTargetWithPolicyAsync`, and config callbacks named `getCpuSmartnessLevel` or `resolveCpuDecisionLevelForPlayer` that are used only by pending/card policy modules.

Do not change the `CpuDecisionMoveSelection` config. It must keep `resolveCpuSmartnessLevel`.

- [ ] **Step 3: Keep hand-destroy log display level**

In `game/cpu-decision-card-actions.ts`, change hand-destroy display logs to use `cfg.readCardUseDisplayLevel(playerKey)` while keeping `cfg.resolveCpuSmartnessLevel(playerKey)` for policy context.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/cpu.decision.refactor.test.ts
```

Expected: the new tests and existing file pass.

### Task 3: Rulebook Update

**Files:**
- Modify: `01-rulebook.md`

- [ ] **Step 1: Add CPU card policy rule**

Add a bullet near the existing CPU level/deck bullets:

```markdown
- CPU のカード使用判断、手札破壊サイクル、カード使用後の対象選択は全レベルで `Lv6: 盤理の観測者` 相当の共有カード方針を使う。通常配置の強さ、表示レベル、CPU専用デッキ、Lv8/Lv9 のカード使用解禁ターンは従来どおり各レベル/各プロフィールの設定を使う
```

Also adjust the later Lv6-specific policy bullets to refer to `CPU共有カード方針` where the rule applies to all levels, without changing card effect rules.

- [ ] **Step 2: Inspect rulebook diff**

Run:

```powershell
git diff -- 01-rulebook.md
```

Expected: only the existing unrelated help-tab diff plus the new CPU card policy wording.

### Task 4: Focused Verification And Commit

**Files:**
- Modified code/tests/docs from Tasks 1-3

- [ ] **Step 1: Run focused CPU tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/cpu.decision.refactor.test.ts test/game.cpu-policy-core.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript checks**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: both exit 0.

- [ ] **Step 3: Run diff checks**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors. Status may still show unrelated pre-existing dirty files; current task files should be separable.

- [ ] **Step 4: Commit only current task files**

Stage only:

```powershell
git add -- game/cpu-decision.ts game/cpu-decision-card-actions.ts test/cpu.decision.refactor.test.ts docs/superpowers/plans/2026-06-25-cpu-card-policy-level6.md
git add -- 01-rulebook.md
git commit -m "cpu: use shared card policy for all levels"
```

If unrelated pre-existing changes in `01-rulebook.md` prevent a clean isolated commit, use `git add -p 01-rulebook.md` and stage only the CPU policy hunk plus the other current task files.
