# リポジトリクリーンアップ調査報告書（最終版）

**調査日**: 2026-05-05
**調査対象**: C:\Users\quarr\Desktop\othello_v2（カードオセロ）
**調査目的**: 消しても問題ないファイルの特定（調査フェーズのみ・削除禁止）
**調査方法**: 4並列エージェント調査 + 手動検証

---

## 1. リポジトリ概要

| 項目 | 数値 |
|------|------|
| Git追跡ファイル数 | 7,112ファイル |
| Git未追跡ファイル数 | 2,300ファイル |
| worker-public/ 内JSファイル | 299ファイル |
| worker-public/ 内TSファイル | 0ファイル |
| root側JSファイル | 1,903ファイル |
| root側TSファイル | 1,858ファイル |
| JS/TSペア（両方存在） | 1,135ファイル |
| assets/ 内ファイル | 227ファイル |
| dist/ 内ファイル | 5,508ファイル（うち3,776ファイルがGit追跡） |

---

## 2. 削除候補ファイル・ディレクトリ（優先度順）

### 🚨 P0: 即座に削除可能（ビルド成果物・一時ファイル）

#### A. ビルド出力ディレクトリ `dist/`（3,776ファイル追跡中）

**状況**:
- `tsconfig.json` の `outDir` は `"./dist"` に設定
- `dist/` 内に 5,508ファイル存在（うち 3,776ファイルがGit追跡されている）
- `dist/dist/` という入れ子構造も存在
- `entry-browser.js` や `entry-browser-classic.js` が `./dist/` パスで参照

**削除理由**:
- TypeScriptのコンパイル出力先であり、ソースから再生成可能
- `package.json` の `testPathIgnorePatterns` に `"<rootDir>/dist/"` が含まれている
- `tsconfig.json` の `exclude` に `"dist"` が含まれている
- Git追跡されているが、ビルド成果物をGit管理する必要はない

**注意事項**:
- 完全削除する前に `npm run build:ts` が正常に動作することを確認すること
- `entry-browser.js` と `entry-browser-classic.js` が `./dist/` パスに依存している

**推奨対応**:
1. `.gitignore` に `dist/` を追加
2. `git rm -r --cached dist/` で追跡解除
3. 作業ディレクトリからも削除

---

#### B. テストカバレッジ `coverage/`（182ファイル追跡中）

**状況**:
- Jest (`--coverage`) の出力
- `clover.xml`, `lcov-report/`, `lcov.info`, `coverage-final.json` を含む
- `.assetsignore` には含まれているが `.gitignore` には含まれていない

**削除理由**:
- `npm run test:jest:coverage` でいつでも再生成可能
- CIツール向けのデータであり、ソースコードではない

**推奨対応**:
1. `.gitignore` に `coverage/` を追加
2. `git rm -r --cached coverage/` で追跡解除

---

#### C. Wranglerキャッシュ `.wrangler/`（76ファイル追跡中）

**状況**:
- Cloudflare Wrangler (`wrangler dev`/`wrangler deploy`) のビルドキャッシュ
- `tmp/bundle-*/middleware-insertion-facade.js` など

**削除理由**:
- `wrangler` コマンド実行時に自動生成される
- ランタイムキャッシュであり、ソースコードではない

**推奨対応**:
1. `.gitignore` に `.wrangler/` を追加
2. `git rm -r --cached .wrangler/` で追跡解除

---

#### D. 一時ファイル `tmp/`（42エントリ）

**状況**:
- デバッグ用スクリーンショット、ログ、テスト出力
- `browser-*.png`（Playwrightビジュアルテストのスクリーンショット）
- `click-*.js`（アドホックなクリックテストスクリプト）
- `work-*.log`, `worker-dev.log`（サーバー/ワーカーのランタイムログ）
- `playwright-network-verify/`, `public-background-verify/`（検証成果物）
- `recovered-background-assets/`（復元アセット）
- `*.json`（中間状態のJSONダンプ）

**削除理由**:
- すべて一時的デバッグ/検証目的のファイル
- 再生成可能または不要

**推奨対応**:
1. `.gitignore` に `tmp/` を追加（まだ追加されていない場合）
2. 作業ディレクトリから `tmp/` 全体を削除

---

#### E. Pythonバイトコードキャッシュ `ai/train/__pycache__/`（14ファイル追跡中）

**状況**:
- 14ファイルの `.pyc` ファイルがGit追跡されている
- `.gitignore` の `!ai/train/**` が `__pycache__/` の無視を打ち消している

**特定されたファイル**:
- `ai/train/__pycache__/` 内11ファイル
- `ai/train/models/__pycache__/` 内3ファイル

**削除理由**:
- Pythonのバイトコードキャッシュは自動生成される
- 再生成可能であり、Git管理する必要なし

**推奨対応**:
1. `.gitignore` に `ai/**/__pycache__/` を追加（`!ai/train/**` の前に）
2. `git rm -r --cached ai/train/__pycache__/` で追跡解除
3. `git rm -r --cached ai/train/models/__pycache__/` で追跡解除

---

#### F. Playwright MCPアーティファクト `.playwright-mcp/`（7ファイル追跡中）

**状況**:
- `page-*.png`（7ファイル）がGit追跡されている
- `page-*.yml`（多数）は `.gitignore` により無視されている

**削除理由**:
- ブラウザ操作のスクリーンショット
- 一時的な検証成果物

**推奨対応**:
1. `.gitignore` に `.playwright-mcp/page-*.png` を追加
2. 追跡中のPNGファイルを `git rm` で削除

---

### ⚠️ P1: 高優先度・確認後に削除可能

#### G. 再帰的にネストされた重複ディレクトリ `game/logic/game/logic/`（22ファイル）

**状況**:
- `game/logic/` ディレクトリが誤って自身の内部にネストされている
- 22ファイル存在（`.ts` + `.js` の両方）
- 内容は `game/logic/cards/` の古いバージョン（例：`chain.ts` が87行 vs 正本の101行）

**特定されたファイル**:
- `game/logic/game/logic/cards/` - chain, clone, costs, defs, flips, meteor, movement, shrink, targets, teleport, will_hunter_king（各 `.ts` + `.js`）
- `game/logic/game/logic/effects/` - destroy_one_stone（`.ts` + `.js`）

**削除理由**:
- 明確なコピーペーストミスによる重複
- `.js` ファイルは `dist/game/logic/game/logic/` を再requireするシム
- `dist/` と `dist/worker-public/` 内にもミラーが存在
- `tsconfig.json` の `exclude` にもリストされている（`game/logic/game/**/*`）

**推奨対応**:
1. `rg` で `game/logic/game/` への参照がないか確認
2. 参照がゼロなら `game/logic/game/` 全体を削除
3. `dist/` 内の対応するミラーも削除

---

#### H. その他の重複ソースツリー（336ファイル追跡中）

**特定されたパス**:
- `game/cards/game/`（~75ファイル）
- `game/logic/game/`（~?ファイル）
- `game/game/`（~?ファイル）

**状況**:
- `game/` ディレクトリ内に、同一内容が深くネストされた重複構造
- `tsconfig.json` の `exclude` に一部リストされている（`game/game/**/*`, `game/cards/game/**/*`）

**削除理由**:
- 明らかなディレクトリ構造のミス
- 古い/古いバージョンのコードが含まれている

**推奨対応**:
1. `rg` で各パスへの参照がないか確認
2. 参照がゼロなら各ディレクトリを削除
3. `dist/` 内の対応するミラーも削除

---

#### I. `worker-public/` 内の孤児ファイル（ミラーに存在しないファイル）

**特定されたファイル**:
1. `worker-public/game/cards/effects/hyperactive.js`
2. `worker-public/game/logic/context.js`
3. `worker-public/shared/types.d.js`

**削除理由**:
- root側に対応する正本が存在しない
- `npm run worker:prepare` で同期される対象外
- おそらく古いミラーの残骸

**推奨対応**:
- 3ファイルを直接削除

---

### 🔍 P2: 中優先度・検証が必要

#### J. JS/TSペア（両方Git追跡されているファイル、1,135ファイル）

**状況**:
- 1,135ファイルで `.js` と `.ts` の両方が存在
- `tsconfig.json` の `allowJs: true` により、JSファイルもコンパイル対象

**代表例**:
- `card-system.js` ↔ `card-system.ts`
- `game/ai/cpu-commentary-runtime.js` ↔ `game/ai/cpu-commentary-runtime.ts`
- `constants/animation-constants.js` ↔ `constants/animation-constants.ts`
- `scripts/` 以下多数

**検討事項**:
- `.js` ファイルは `.ts` のコンパイル出力か、それとも別物か？
- もしコンパイル出力なら `.js` を削除し、`.ts` のみを管理すべき
- ただし、一部の `.js` は手書きで `.ts` と内容が異なる可能性あり
- `import './foo.js'` や `require('./foo.js')` 形式の参照がないか確認が必要

**推奨アプローチ**:
1. `rg "require\('\./.*\.js'\)"` と `rg "from\s+'\./.*\.js'"` で参照を検索
2. 各ペアのdiffを取る
3. 同一内容で参照がないなら `.js` を削除
4. 内容が異なる場合は、どちらが正本か判断

---

#### K. ルートレベルの分析スクリプト（自己完結型、参照ゼロ）

**特定されたファイル**:
- `analyze-crystal-stone-quiet.ts` + `.js`
- `analyze-crystal-stone.ts` + `.js`
- `analyze-destroy-cycle.ts` + `.js`
- `analyze-selfplay-moves.ts` + `.js`
- `analyze-trap-will.ts` + `.js`
- `scripts/analyze-stone-circle.ts` + `.js`
- `scripts/analyze-stone-margins.ts` + `.js`

**削除理由**:
- 自己完結型のアドホック分析スクリプト
- `package.json` の `scripts` から参照されていない
- 他からのimport/requireなし

**推奨対応**:
- 各ファイルの最終更新日を確認
- 古い（数ヶ月以上更新なし）なら削除

---

#### L. アドホック修正スクリプト（参照ゼロ）

**特定されたファイル**:
- `check_module_registry.js`
- `fix_module_registry.js`
- `fix_registry_properly.js`

**削除理由**:
- ワンタイム修正スクリプト
- コードベース全体で参照ゼロ

**推奨対応**:
- 3ファイルを削除

---

### 📄 P3: 低優先度・文書/ログ類

#### M. 孤立文書ファイル

**特定されたファイル**:
- `BACKEND_ARCHITECTURE_AUDIT.md`（351行、コードベース全体で参照ゼロ）
- `inconsistencies_report.md`（内容は"✅ No inconsistencies found"のみ、参照ゼロ）

**削除理由**:
- 監査完了後のレポート
- 他のファイルから参照されていない

**推奨対応**:
- 2ファイルを削除

---

#### N. ログ・出力テキストファイル（再生成可能）

**特定されたファイル**:
- `bundle-check.log`（wranglerバンドルログ）
- `network-audit-output.txt`（jest実行ログ）
- `server.log`（空ファイル）
- `server-err.log`（空ファイル）
- `flip-evidence-minimal.txt`
- `trap-output.txt`
- `task-*.txt`（11ファイル）
- `tsc_*.txt`（tscエラー出力、5ファイル）
- `test_output.txt`, `test_run_output.txt`, `test-output.txt`
- `tmp_worker_prepare.txt`, `tmp_pre_fix_regressions.txt`
- `docs/cleanup-log-2026-05-02.txt`

**削除理由**:
- すべて一時的なログ出力またはデバッグ成果物
- 再生成可能または不要

**推奨対応**:
- 一括削除
- `.gitignore` に `*.log` が既に含まれていることを確認

---

#### O. 分析JSONファイル（再生成可能）

**特定されたファイル**:
- `analysis-output.json`
- `selfplay_analysis_summary.json`
- `selfplay_analysis.ndjson.summary.json`
- `selfplay_card_analysis.json`
- `test-results.json`
- `tmp_deploy.json`
- `tmp_pre_fix_regressions.json`

**削除理由**:
- 分析結果のダンプ
- 一時的な中間生成物

**推奨対応**:
- 一括削除

---

#### P. 分析テキストファイル（PLACEMENT/ハイパーアクティブ分析）

**特定されたファイル**:
- `HYPERACTIVE_DUPLICATION_ANALYSIS.txt`
- `PLACEMENT_ANALYSIS.txt`
- `PLACEMENT_CODE_REFERENCE.txt`
- `PLACEMENT_EXECUTIVE_SUMMARY.txt`
- `PLACEMENT_FLOW_DIAGRAM.txt`

**削除理由**:
- アドホックな分析ドキュメント
- コードベースから参照されていない

**推奨対応**:
- 内容を確認し、有用な情報があれば適切なドキュメントに統合
- それ以外は削除

---

#### Q. スクリーンショット/画像ファイル（検証用）

**特定されたファイル**:
- `hand-*.png`（12ファイル）
- `playwright-boot-test.png`
- `background-restored-public.png`
- `background-skin-modal-public-20260426.png`
- `public-background-room-create-verified.png`
- `public-observation-desk-no-bars-verified.png`
- `public-observation-desk-svg-verified.png`

**削除理由**:
- 検証/デバッグ目的の一時的スクリーンショット
- コードベースから参照されていない

**推奨対応**:
- 一括削除
- `.gitignore` に `*.png` を追加（ただし `assets/` 内は除外）

---

#### R. その他の謎ファイル

**特定されたファイル**:
- `1045`（6バイト、数値ファイル）
- `4368`（6バイト、数値ファイル）
- `221451`（6バイト、数値ファイル、非追跡）
- `UTF8/UTF8`（11バイト、ディレクトリ内のファイル）
- `page-snapshot.yml`（Playwrightページスナップショット）

**削除理由**:
- クリップボード操作や誤操作による残骸と思われる
- 意味不明なファイル

**推奨対応**:
- 一括削除

---

#### S. `export_for_project/` ディレクトリ

**特定されたファイル**:
- `export_for_project/cards_spec.txt`

**削除理由**:
- 外部出力用のカード仕様テキスト
- コードベースから参照されていない

**推奨対応**:
- ディレクトリごと削除

---

### 📦 P4: 設定のクリーンアップ

#### T. `package.json` のファントム参照

**状況**:
- `01-CARD-OTHELLO/` が `testPathIgnorePatterns` に含まれている
- しかし、ディレクトリは存在しない（ファントム参照）

**推奨対応**:
- `package.json` から `01-CARD-OTHELLO/` の行を削除

---

#### U. `.gitignore` の不足パターン

**追加が必要なパターン**:
```
# Build outputs
dist/
coverage/

# Cloudflare Wrangler cache
.wrangler/

# Playwright MCP artifacts
.playwright-mcp/page-*.png
.playwright-mcp/*.txt

# Python cache
ai/**/__pycache__/

# Temporary files
tmp/

# Tool runtimes
.opencode/
```

---

### 🔮 P5: 追加調査が必要

#### V. `scripts/` ディレクトリ内のJSのみファイル（TS版がないもの）

**特定されたファイル（20件）**:
- `add-module-tracking.js`
- `augment-entry-v2.js`, `augment-entry.js`
- `boot-debug.js`, `boot-debug2.js`, `boot-test.js`, `boot-test2.js`, `boot-test3.js`
- `browser-boot-smoke.js`
- `check-bootstrap.js`, `check-format.js`, `check-init-factory.js`
- `check-registry-content.js`, `check-registry-content2.js`
- `check-registry-dups.js`, `check-registry-dups2.js`
- `clean-dist-require.js`
- `compare-test-baseline.js`
- `cross-ref-scripts.js`
- `debug-single.js`

**検討事項**:
- `package.json` の `scripts` から参照されていない
- 一時的なデバッグ・検証スクリプトの可能性
- ファイル名に "debug", "test", "check" が含まれるものが多い

**推奨対応**:
- 各ファイルの最終更新日と内容を確認
- 古い（数ヶ月以上更新なし）なら削除

---

#### W. `assets/` ディレクトリ内の未使用アセット

**状況**:
- 227ファイル存在
- `assets/story/stones/` に大量の石画像
- `silver.stone.png`（命名規則から外れたファイル名）

**検討事項**:
- `generate-asset-manifest.js` で生成されるマニフェストと比較必要
- マニフェストに含まれないアセット = 未使用の可能性
- 重複SHA256の画像がある可能性

**推奨対応**:
- `assets-manifest.json` と実ファイルを比較
- マニフェストに含まれないファイルをリストアップ
- 重複SHA256の画像を特定

---

#### X. `docs/archive/` ディレクトリ（26ファイル）

**状況**:
- 2026年2-3月の古い計画文書
- `docs/archive/README.md` に目的が記載

**特定されたファイル例**:
- `stone-shadow-stability-plan-2026-03-19.md`
- `special-stone-speech-implementation-plan-2026-03-26.md`
- `network-match-v2-rebuild-plan-2026-03-15.md`
- など26ファイル

**検討事項**:
- 歴史的参考資料として意図的に保存されている可能性
- 現在の計画（`docs/plans/`）と重複している

**推奨対応**:
- プロジェクトの文書管理ポリシーを確認
- 歴史的価値がなければ削除

---

#### Y. ルートレベルの古いMDファイル

**検討対象**:
- `special-stone-speech-draft.md`（`01-rulebook.md` から参照されている可能性）
- `task-7-worker-entry-map.md`（完了済みタスクの記録）

**推奨対応**:
- 参照関係を確認
- 参照がなければ削除

---

#### Z. `src/` ディレクトリ（古いTypeScriptソース）

**状況**:
- 13 `.ts` ファイル + 17 `.js` シム
- `board.ts`, `card.ts`, `player.ts`, `game.ts`, `index.ts`, `types/*.ts`, `protocol/*.ts`, `engine/*.ts`
- 古いTypeScriptソースツリーと思われる

**検討事項**:
- 現在の構造（`game/`, `ui/`, `shared/`）に置き換えられた可能性
- `.js` シムは `dist/src/` を再require

**推奨対応**:
- `rg` で `src/` への参照がないか確認
- 参照がゼロなら削除

---

## 3. 削除禁止ファイル（クリーンアップ対象外）

以下は **削除してはいけない** ファイル・ディレクトリ:

| ファイル/ディレクトリ | 理由 |
|----------------------|------|
| `node_modules/` | `.gitignore` 対象、依存関係管理用 |
| `01-rulebook.md` | 仕様の一次情報 |
| `AGENTS.md` | 作業導線の正本 |
| `.github/copilot-instructions.md` | 強制ルール |
| `cards/catalog.json` | カードデータの正本 |
| `game/`, `ui/`, `workers/` | コアソースコード |
| `ai/train/` | `.gitignore` で明示的に追跡対象 |
| `test/`, `tests/` | テストコード |
| `worker-public/`（全体） | AGENTS.mdによりミラーとして定義済み |
| `shared-constants.ts` | 定数の正本 |
| `constants/` | 定数定義ディレクトリ |

---

## 4. 推奨されるクリーンアップ順序

### Phase 1: 安全な削除（即座に実行可能）
1. `.gitignore` の更新（`dist/`, `coverage/`, `.wrangler/`, `tmp/`, `.playwright-mcp/`）
2. `git rm -r --cached dist/ coverage/ .wrangler/`
3. `ai/train/__pycache__/` の追跡解除と削除
4. `tmp/` ディレクトリの削除
5. ルートのログ・テキストファイルの削除
6. ルートの分析JSONファイルの削除
7. ルートのスクリーンショットPNGファイルの削除
8. `1045`, `4368`, `UTF8/`, `page-snapshot.yml` の削除
9. `export_for_project/` の削除
10. `package.json` から `01-CARD-OTHELLO/` の参照削除

### Phase 2: 検証後の削除
11. `game/logic/game/` 重複ディレクトリの削除（参照確認後）
12. `game/cards/game/`, `game/game/` 重複ディレクトリの削除（参照確認後）
13. `worker-public/` 内の孤児ファイル3件の削除
14. JS/TSペアの比較と `.js` 側の削除（1,135ファイル、参照確認後）
15. ルートの分析スクリプトの削除（更新日確認後）
16. アドホック修正スクリプトの削除

### Phase 3: 追加調査後の削除
17. `scripts/` 内の未使用JSスクリプトの確認と削除
18. `assets/` 内の未使用アセットの特定と削除
19. `docs/archive/` の整理
20. `src/` ディレクトリの確認と削除（参照確認後）
21. `BACKEND_ARCHITECTURE_AUDIT.md`, `inconsistencies_report.md` の削除

### Phase 4: 最終確認
22. `npm run build:ts` が成功することを確認
23. `npm run test:jest` が成功することを確認
24. `npm run worker:prepare` が成功することを確認

---

## 5. リスク評価

| 削除対象 | リスクレベル | 理由 |
|---------|------------|------|
| `dist/` | 🟢 低 | ビルドで再生成可能 |
| `coverage/` | 🟢 低 | テストで再生成可能 |
| `.wrangler/` | 🟢 低 | wranglerコマンドで再生成 |
| `tmp/` | 🟢 低 | 一時ファイル |
| `ai/train/__pycache__/` | 🟢 低 | Python自動生成 |
| `.playwright-mcp/` PNG | 🟢 低 | スクリーンショット |
| ログ・テキストファイル | 🟢 低 | 再生成可能または不要 |
| 分析JSON/テキスト | 🟢 低 | 一時成果物 |
| スクリーンショットPNG | 🟢 低 | 検証用 |
| `worker-public/` 孤児 | 🟢 低 | 正本が存在しない |
| `game/logic/game/` | 🟡 中 | 参照確認が必要 |
| `game/cards/game/` | 🟡 中 | 参照確認が必要 |
| JS/TSペアのJS | 🟡 中 | import参照確認が必要 |
| `scripts/` 未使用JS | 🟡 中 | 更新日・内容確認が必要 |
| `assets/` 未使用 | 🟡 中 | マニフェスト比較が必要 |
| `docs/archive/` | 🟢 低 | 歴史文書だが削除可能 |
| `src/` ディレクトリ | 🟡 中 | 参照確認が必要 |
| `BACKEND_ARCHITECTURE_AUDIT.md` | 🟢 低 | 参照なし |

---

## 6. 結論

### 削除可能ファイル数の見積もり

| フェーズ | 推定ファイル数 | リスクレベル |
|---------|--------------|------------|
| Phase 1（即座に削除可能） | ~4,100ファイル | 🟢 低 |
| Phase 2（検証後に削除可能） | ~1,400ファイル | 🟡 中 |
| Phase 3（追加調査後） | ~200ファイル | 🟡 中 |
| **合計** | **~5,700ファイル** | - |

### 削減効果

- **現在のGit追跡ファイル数**: 7,112ファイル
- **削減見込み**: ~5,700ファイル（**80%削減**）
- **残存見込み**: ~1,400ファイル

### 最大の問題と対応

**最大の問題**: `dist/`（3,776ファイル）がGit追跡されている
- 根本原因: `.gitignore` に `dist/` が含まれていない
- 対応: `.gitignore` に追加し、`git rm -r --cached` で追跡解除

**第二の問題**: JS/TSペア（1,135ファイル）
- 根本原因: TypeScript移行時に `.js` ファイルを削除していない
- 対応: 参照関係を確認し、機械的に `.js` を削除

**第三の問題**: 重複ソースツリー（336ファイル）
- 根本原因: ディレクトリ構造のミス（コピーペーストエラー）
- 対応: 参照確認後、機械的に削除

---

## 7. 注意事項

1. **本報告書は調査フェーズの成果物です**。実際の削除作業を行う前に、各ファイルの参照関係を再確認してください。

2. **バックアップを取得**してから削除作業を行ってください。

3. **段階的に削除**し、各フェーズ後に `npm run build:ts` と `npm run test:jest` を実行して動作確認を行ってください。

4. **`.gitignore` の更新は最初に行う**ことを推奨します。これにより、新たなビルド成果物が誤って追跡されるのを防ぎます。

5. **`worker-public/` はミラーとして定義されている**ため、root側のファイルを削除する際は、worker-public側も同期する必要があります。

---

**報告書作成完了**
