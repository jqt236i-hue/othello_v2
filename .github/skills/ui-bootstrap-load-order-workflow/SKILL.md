---
name: 'ui-bootstrap-load-order-workflow'
description: 'index.html の script 順、shared/ui-bootstrap-shared.js と ui/bootstrap.js の DI、window 使用境界を、この repo の classic-script 前提で安全に直すワークフロー。Use when editing index.html, shared/ui-bootstrap-shared.js, ui/bootstrap.js, ui/handlers/init.js, scripts/check-window-usage.js, or related load-order/bootstrap tests in this card-othello repository.'
argument-hint: 'load order や bootstrap のどこを直したいか。script 順, DI, window usage なども書く'
---

# UI Bootstrap Load Order Workflow

このスキルは、classic script 前提の load order、`shared/ui-bootstrap-shared.js` と `ui/bootstrap.js` の DI、`window` 使用境界を安全に直す時の手順です。

## When to Use

- `index.html` の script 順や preload 順を変える時
- `shared/ui-bootstrap-shared.js` の shim / forwarding / lazy install を直したい時
- `ui/bootstrap.js` の依存注入を直したい時
- `window` 使用や bootstrap 初期化順の不具合を直したい時
- root と `worker-public/` の load order がずれている時

## Read First

- `01-rulebook.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- 触る領域に対応する `.github/instructions/*.instructions.md`

## Primary Files

- `index.html`
- `shared/ui-bootstrap-shared.js`
- `ui/bootstrap.js`
- `ui/handlers/init.js`
- `scripts/check-window-usage.js`
- 関連 test: `test/index.card-module-scripts.test.js`, `test/index.local-script-paths.test.js`, `test/ui.bootstrap.cpu-early-registration.test.js`

## Common Traps

- classic script 順を変えて暗黙依存を壊すこと
- DI で吸収すべき依存を `window` へ逃がすこと
- root 側の classic-script / DI 問題まで mirror 同期の話として扱い、`worker-public-sync-workflow` との境界をぼかすこと
- root と `worker-public/` の path / order をずらすこと
- 新しい global export を増やして初期化順依存を深くすること

## Procedure

1. まず `index.html`, `shared/ui-bootstrap-shared.js`, `ui/bootstrap.js` の script 順と DI 入口を確認する。
2. 問題が load order、DI、window usage、path mismatch のどこにあるかを分ける。
3. 公開入口を増やさず、既存 bootstrap 経路の中で解決する。
4. root 側の classic-script / DI 問題はこの skill で扱い、mirror / prepare / deploy の同期自体は `worker-public-sync-workflow` に分ける。
5. path / order が変わる時は root と `worker-public/` の mirror を一緒に確認する。
6. window usage check と path / order test を後回しにしない。

## Validation Bundle

- `test/index.card-module-scripts.test.js`
- `test/index.local-script-paths.test.js`
- `test/ui.bootstrap.cpu-early-registration.test.js`
- `test/ui.bootstrap-shared.test.js`
- `test/ui.bootstrap-shared.forwarding.test.js`
- `test/ui.bootstrap.lazy-install.test.js`
- `test/ui.init.async-policy-load.test.js`
- `test/ui.init.playback-runtime.test.js`
- `test/code.window-usage.test.js`
- `npm run check:window`

## Completion Checklist

- script 順と DI の契約が明確になっている
- 不要な `window` 公開を増やしていない
- path / order / bootstrap の確認結果を報告している
- `01-rulebook.md` と `worker-public/` 同期の有無を報告している
