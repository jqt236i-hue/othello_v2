---
name: 'playwright-local-game-test-workflow'
description: 'ローカルサーバー上で headed の実ブラウザを Playwright で直接動かし、AI エージェントが script 実行だけで済ませず、自分の click / fill / evaluate / wait でゲームを実機検証するワークフロー。visible な新規 Chrome / browser window または新規 tab を実際に開けない時は fallback せず失敗として報告する。必要時だけ chrome-devtools を console / network / trace 補助として併用する。debug mode は通常 URL で開いた後、UI 上の DEBUG ボタンを押して有効化する前提で進める。Use when you want an agent to directly drive local card-othello gameplay with Playwright, verify UI and board behavior in a real browser, and optionally capture deeper browser evidence with Chrome DevTools.'
argument-hint: '何をローカル実機確認したいか。single-player か room 対戦か、カード使用有無、animation も見るか、debug mode 要否、chrome-devtools 併用要否、再現したい症状を書く'
---

# Playwright Local Game Test Workflow

このスキルは、ローカルサーバー上のゲームを AI エージェントに **Playwright で直接ブラウザ操作させる** 時の手順です。Playwright と言われたら、既存の Node script や一時 runner を回すだけで済ませず、agent 自身が page を開いて board や UI を操作し、必要なら chrome-devtools を補助で併用します。

## When to Use

- 「Playwright で確認して」「実ブラウザで再現して」のように、agent 自身のブラウザ操作が期待されている時
- `npm run serve` で起動したローカルサーバー上のゲームをブラウザで開いて、board、手札、ボタン、overlay、log を目で確認したい時
- script 実行だけでは足りず、クリック経路・hover・入力・待機・スクリーンショットまで agent にやらせたい時
- あなたの PC 上で visible な新規 Chrome / browser window または新規 tab が実際に開いたことまで確認したい時
- 通常のローカルサーバー URL で開き、必要になった時だけ UI 上の DEBUG ボタンを押して state 観察や debug helper を使いたい時
- fix 後に single-player または room 対戦のローカル再確認を headed ブラウザでやりたい時
- console / network / trace も取りたいが、主役はあくまで Playwright の直接操作であるべき時

## Do Not Use

- 純粋な unit / jest だけで十分な時は、この skill ではなく近い test を直接使う
- 同室 2 ブラウザの network 特有 bug を終局まで追うのが主目的なら `network-selfmatch-bug-hunt-workflow`
- 演出再生順や visual playback 契約の修正が主目的なら `animation-visual-playback-workflow`
- 指示文の整理だけが目的なら `prompt-refinement-workflow`

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- `test/e2e/e2e-runtime-helpers.js`
- `test/e2e/cpu.e2e.test.ts`
- `test/e2e/card_effects.e2e.test.ts`
- `scripts/browser-boot-smoke.js`
- room 対戦なら `network-selfmatch-bug-hunt-workflow`

## Primary Files

- `package.json`
- `scripts/serve-with-fallback.ts`, `scripts/serve-with-fallback.js`
- `scripts/local-match-server.ts`, `scripts/local-match-server.ts / .js shim`
- `index.html`（エントリポイント。**`file:///` で開かず、`npm run serve` 経由で配信する**）
- `ui/bootstrap.ts / .js compatibility shim`
- `test/e2e/e2e-runtime-helpers.js`
- `test/e2e/cpu.e2e.test.ts`
- `test/e2e/card_effects.e2e.test.ts`
- `test/e2e/multi_turn_progression.e2e.test.ts`
- `scripts/browser-boot-smoke.js`
- 参考用の一時 runner 群: `tmp/playwright-network-verify/*`, `tmp/check-globals.js`, `tmp/deep-board-check.js`

## Common Traps

- Playwright 指定なのに `npm test` や `node tmp/*.js` だけ実行して、自分でブラウザを開かないこと
- Playwright が使えない時に headless script や Jest / smoke script へ黙って fallback すること
- visible な新規 Chrome / browser window / tab を開かず、既存の見えない session や既存 tab だけを再利用して済ませること
- `file:///` で `index.html` を直接開いてしまい、`npm run serve` を起動せずに実機確認した気になること
- headless 実行だけで見た目崩れを確認した気になること
- 通常 URL で開く前提なのに、最初から `?debug=1` 付き URL で開いてしまい、通常起動 + DEBUG ボタン押下の経路を確認しないこと
- DEBUG ボタンを押す前に `window.DebugActions` を探して「ない」と判断すること
- `window.gameState` / `window.cardState` / DOM 初期化完了前に board を触ること
- UI 経路の確認が必要なのに `page.evaluate()` で内部関数直呼びだけして終えること
- animation を見たいのに `noanim=1` を混ぜること
- chrome-devtools を主役にして、Playwright の click / fill / wait をやらないこと
- room 対戦なのに local static server だけ起動して `match:server` を立て忘れること

## Procedure

1. まず scope を `single-player` / `room 対戦`、`state-only` / `UI 含む`、`card なし baseline` / `card 使用あり` に分類する。
2. **`npm run serve` を必ず起動する。** `file:///` で `index.html` を直接開くのは禁止。ブラウザは必ず HTTP 経由で開く。既定では app URL を `http://127.0.0.1:8000/` とみなし、port scan や `--port 0` で変わったら実際の URL を記録する。host は `localhost` より `127.0.0.1` を優先する。**この workflow では最初から `?debug=1` 付き URL を開かず、通常 URL で起動した後に UI 上の `DEBUG: OFF` ボタンをクリックして debug mode を ON にする。** room 対戦や network 経路も見るなら別ターミナルで `npm run match:server` も起動する。
3. **Playwright と言われたら、まず Playwright ツールで visible な実ブラウザを直接開く。** あなたの PC 上で新規 Chrome / browser window または新規 tab が実際に開いたことを確認する。既存の script / runner は参考や補助に留め、ブラウザ駆動そのものを代行させない。UI / animation を見る時は headed を既定にし、headless はこの workflow では使わない。
4. Playwright session が他タスクに使用中で新規 visible browser を開けない、または browser tool が既存見えない session 再利用に流れそうなら、**headless script や chrome-devtools 単独へ fallback せず、その場で失敗として報告する。** 必要なら「Playwright browser is already in use」などの競合状況をそのまま記録する。
5. page 読み込み後は、少なくとも `window.gameState` に 8x8 board があり、`window.cardState` が object で、必要な操作入口（例: `window.passCurrentTurn`, `window.isGameOver`, `window.NetworkMatchClient`）が揃うまで待つ。`test/e2e/cpu.e2e.test.ts` の `waitForFunction` パターンを基準にする。
6. 操作は Playwright の `click`, `fill`, `type`, `hover`, `select`, `evaluate`, `waitForFunction`, `locator` を主経路にする。内部関数直呼びは、debug hand 充填や state 採取など UI 外の補助セットアップに限定する。
7. single-player ではまず baseline を取り、必要になった時だけ `DEBUG: OFF` ボタンをクリックして debug mode を開き、board と手札の操作性を確認する。カード検証では `test/e2e/card_effects.e2e.test.ts` のように、DEBUG ON 後に `window.DebugActions`, `window.CardLogic`, `window.useSelectedCard` の有無を待ってから進める。
8. room 対戦では 2 page 以上を Playwright で自分で開き、同じ room に join させる。主目的が network divergence の切り分けなら `network-selfmatch-bug-hunt-workflow` に切り替える。
9. 各 action の後で、overlay close、playback idle、turn 収束、log 反映、必要なら最終 result 表示まで待つ。クリック直後の一瞬の state を見て成功扱いしない。
10. chrome-devtools は **補助** としてだけ使う。console message、network request、performance trace、詳細 screenshot が必要な時に併用し、実際のゲーム操作は最後まで Playwright で続ける。chrome-devtools だけでブラウザ検証を完結させない。
11. 失敗時は URL、browser 種別、visible window / tab が開いたかどうか、実行した action、console / network 証跡、最終 screenshot、必要なら `window.gameState` / `window.cardState` の抜粋を残す。
12. code を直した後は、同じ Playwright 実機確認を同条件でやり直し、必要に応じて近い e2e / jest / visual check へ接続する。

## Validation Bundle

- `npm run serve` で local UI が開ける
- room 対戦を含むなら `npm run match:server` も起動できる
- あなたの PC 上で visible な新規 Chrome / browser window または新規 tab が実際に開いた
- 通常 URL で page を開いた後、必要なら DEBUG ボタン押下後の page で、`window.gameState` と `window.cardState` が準備完了になる
- agent が `file:///` でなく `http://` 経由でページを開いていることを確認した
- agent が script 実行だけで終わらず、Playwright で実際に browser tab / page を開いて操作している
- UI を見る時は headed 実行であり、headless に逃げていない
- 必要時に console / network / screenshot / trace が採取できている
- code を触ったなら、近い確認として必要に応じて次へ接続する
  - `test/e2e/cpu.e2e.test.ts`
  - `test/e2e/card_effects.e2e.test.ts`
  - `test/e2e/multi_turn_progression.e2e.test.ts`
  - `tests/visual-regression/run-visual-check.js`
  - `npm run match:check`

## Completion Checklist

- Playwright 指定時に、agent 自身が直接 browser を開いて操作した
- visible な新規 Chrome / browser window または新規 tab が実際に開いた
- `file:///` ではなく `http://` 経由でページを開いた
- local server / match server の要否を最初に固定した
- 通常 URL で開いたこと、DEBUG ボタンを押したかどうか、headed / headless 方針、card 使用有無を記録した
- UI 経路確認と state 補助確認を混同せず、どこで `evaluate` を使ったか説明できる
- chrome-devtools を使った場合も、主操作は Playwright のままで、単独 fallback していない
- 失敗時の screenshot / state / console / network 証跡を残した
- code を触った場合は実行した test / check、`01-rulebook.md` 更新有無、`worker-public/` 同期有無を報告した
