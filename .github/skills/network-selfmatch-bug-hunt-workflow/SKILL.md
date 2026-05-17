---
name: 'network-selfmatch-bug-hunt-workflow'
description: 'Playwright で headed の 2 ブラウザを同室接続し、終局・同期・結果反映に加えて UI / animation の崩れまで確認し、network 対戦特有の不具合を炙り出すワークフロー。Use when verifying same-room play across two visible browsers, reproducing network-only bugs, or capturing end-to-end evidence for room create/join, turn sync, pass, pending selection, and result divergence in this card-othello repository.'
argument-hint: 'どの環境で何を見たいか。public か local か、create/join only か full match か、UI / animation も見るか、カードも使うか、再現したい症状を書く'
---

# Network Selfmatch Bug Hunt Workflow

このスキルは、Playwright で headed の 2 ブラウザを実際に開き、同じ部屋に入れて対戦させ、network 対戦特有のズレ、終局不整合、UI / animation の崩れを証跡付きで切り分ける時の手順です。

## When to Use

- room 作成や参加は通るのに、対戦開始後に state がずれる時
- Chrome と Edge など別ブラウザ間で turn、board、result overlay が一致しない時
- 終局まで自動進行させて network-only bug を探したい時
- 終局できても flip、highlight、overlay、busy 表示など見た目や演出だけが崩れる時
- 手動再現が重く、agent 同士の selfmatch で room ID、行動履歴、最終画面を残したい時
- fix 後に public 配備先または local worker で再確認したい時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`
- 見た目や再生順の疑いがある時は `animation-visual-playback-workflow`
- network client 側を直す見込みなら `network-playback-workflow`
- worker authority 側を直す見込みなら `network-backend-worker-workflow`

## Primary Files

- 必要時に自分で用意して使う `tmp/playwright-network-verify/` 一時 runner 置き場
- `ui/network-client.ts / .js shim`
- `ui/network/snapshot.ts / .js shim`
- `workers/match-worker.mjs`
- `scripts/local-match-server.ts / .js shim`
- `test/ui.network-client.multi-stage-selection.test.js`
- `test/ui.network-client.result-sync.test.js`
- `test/ui.network-snapshot.move-source-empty.test.js`
- `test/ui.network-snapshot.hyperactive-source-empty.test.js`

## Common Traps

- 片側だけの手番更新を見て進め、実際には相手側が追いついていないこと
- overlay や playback の busy 状態を閉じずに board を触ること
- baseline smoke の段階からカード使用を混ぜ、network bug と card bug を分離できなくすること
- card-inclusive run の `pending selection` を legal-move-only baseline の異常と同じ意味で扱うこと
- legal move が 0 の時に pass せず、停止を bug と誤認すること
- UI / animation bug を見たいのに headless 実行や内部関数直呼びだけで済ませ、見た目の経路を通さないこと
- room ID、action log、最終スクリーンショット、失敗時 state を残さないこと
- 同じブラウザ内の 2 context だけで満足し、ブラウザ差分を見落とすこと

## Procedure

1. まず対象を `public` か `local` か、`create/join only` か `full match` か、`state-only` か `UI / animation 含む` か、`legal move only` か `card-inclusive` かに分類する。
2. `local` を見るなら `npm run serve` と別ターミナルの `npm run match:server` を起動し、`public` 相当を worker dev で見るなら `npm run serve` と別ターミナルの `npm run worker:dev` を起動して、使う base URL を先に固定する。
3. production code を直し始める前に、必要なら `tmp/playwright-network-verify/` を使い、無ければ作って一時 runner を置き、再現と証跡を先に固定する。
4. UI / animation を見る時は headed を既定にし、Chrome と Edge のように別 channel の実ブラウザを開く。headless は CI や補助確認だけにとどめる。
5. 各 page で `NetworkMatchClient`、`gameState`、`cardState`、`passCurrentTurn`、`isGameOver` が使える状態まで待つ。
6. 片側で room を作り、もう片側を参加させ、`hasTwoPlayers()` と overlay close を確認してから進める。
7. 各 action の前後で、両 page の `currentPlayerKey` と `turnIndex` が一致するまで待つ。片側だけの変化で先へ進めない。
8. baseline は card を使わず、legal move がある時だけ deterministic に置き、legal move が 0 の時だけ pass する。UI / animation を見る時は DOM click 経路を優先し、内部関数直呼びは補助にとどめる。
9. action ごとに playback idle と visible overlay の収束を待ち、board、stone、hand、highlight、result overlay の見た目差分を観察する。
10. legal-move-only baseline で `pending selection` が出たら想定外なので、その時点で止めて bug として room ID、直前 action、両 page state を保存する。card-inclusive run では card 仕様の可能性を切り分けてから bug 判定する。
11. failure 時は room ID、browser 割当、action log、最終 state JSON、スクリーンショットを必ず保存する。UI / animation 疑いなら可能なら動画、console、network request も取る。
12. 再現後は bug を `room/create/join`, `snapshot/playback divergence`, `visual/playback divergence`, `pending selection`, `result sync`, `worker authority` のどこかに分類し、対応 skill と test へ接続する。
13. fix 後は同じ runner を同じ環境で再実行し、終局まで到達し、両 page が同じ turn と最終枚数へ収束し、見た目の破綻も再発しないことを確認する。

## Validation Bundle

- 2 client が同じ room に入り、2 players 状態になる
- 両 page の `currentPlayerKey` と `turnIndex` が action ごとに同期している
- headed の 2 ブラウザで board、highlight、overlay、flip の見た目を確認できる
- match が `gameOver` または result overlay まで到達する
- 必要時に使った `tmp/playwright-network-verify/` に result JSON と final screenshot が残る
- 症状に応じて次を実行する
  - `test/ui.network-client.multi-stage-selection.test.js`
  - `test/ui.network-client.result-sync.test.js`
  - `test/ui.network-snapshot.move-source-empty.test.js`
  - `test/ui.network-snapshot.hyperactive-source-empty.test.js`
  - `test/ui.animation-engine.inherited-hyperactive-timer.test.js`
  - `test/ui.animation-engine.guard-timer.test.js`
  - `test/game.pending-selection-flow.test.js`
  - `test/game.movement-selection-turn-handoff.test.js`
  - `test/game.trap-selection-turn-handoff.test.js`
  - `test/game.swap-selection-turn-handoff.test.js`

## Completion Checklist

- 対象環境、browser 組み合わせ、scope を最初に固定している
- UI / animation を見る場合は headed 実行にした、または例外理由を残している
- baseline の legal-move-only selfmatch を先に通している、または通らなかった証跡を残している
- room ID、action log、最終 state、スクリーンショットを保存している
- 見た目崩れがあった時に animation-visual-playback-workflow へ接続できる分類を残している
- bug の分類先と、次に見る root file / test が明確になっている
- code を触った場合は実行した test / check、`01-rulebook.md` 更新有無、`worker-public/` 同期有無を報告している
