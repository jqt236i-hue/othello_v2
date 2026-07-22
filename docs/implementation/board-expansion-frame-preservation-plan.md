# 盤面拡張後のフレーム保持 実装計画

- Status: complete
- Date: 2026-07-23
- Design: `docs/implementation/board-expansion-frame-preservation-design.md`

## Phase 0 — 契約固定

- [x] dirty worktreeがないことを確認する。
- [x] ルールブック、architecture contract、Pixi/DOM ownership、既存テスト、回帰履歴を確認する。
- [x] 根本原因を「render voidとbase voidの混同」として固定する。
- [x] player-visible仕様変更が不要であることを確認する。

Done when: 設計書が初期盤面マスク、クラス所有、両backend、rollback、検証範囲を説明している。

## Phase 1 — 表示モデルへ初期盤面マスクを伝播

- [x] `BoardRenderTopologyModel` に必須の `baseKeys` を追加する。
- [x] model builderがcanonical topologyの `baseKeys` を投影する。
- [x] model normalization/freezeとframe fingerprintへ `baseKeys` を含める。
- [x] 既存のtyped fixture/factoryを新契約へ合わせる。

Done when: typecheckと表示モデルfocused testが通り、base shapeを`existingKeys`から推測する必要がない。

## Phase 2 — フレーム表示方針を分離

- [x] frame presenterでrender voidとbase voidを別々に判定する。
- [x] `board-has-void-cells` は`#board`、`board-has-base-void-cells`は`#board-frame`だけへ適用する。
- [x] DOM compatibility rendererから`#board-frame`への直接class書き込みを外す。
- [x] board renderer transaction rollbackへ新classを含める。
- [x] CSSの画像フレーム無効化条件をbase void classへ切り替える。
- [x] staleな内部設計記述を更新する。

Done when: 通常8x8の拡張ではフレーム画像が残り、初期欠け盤面では従来どおりCSS輪郭になる。

## Phase 3 — 回帰テスト

- [x] frame presenter testへ完全8x8＋疎な拡張、初期欠け、stale class cleanupを追加する。
- [x] CSS contract testで新classだけがフレームを隠すことを固定する。
- [x] 実カードE2Eへ拡張後のcomputed style/class assertionを追加する。
- [x] 既存のboard/Pixi focused testを実行する。

Done when: 旧バグを再導入するとfocused testまたはE2Eが失敗する。

## Phase 4 — ブラウザ実機検証と配信物同期

- [x] classic/Viteの最小Pixi browser checkを実行する。
- [x] 通常8x8、盤面拡張、盤面拡張神、初期欠け盤面をスクリーンショットとdiagnosticsで確認する。
- [x] `npm run build:browser` を実行する。
- [x] 必要なworker mirrorを既存生成手順で同期する。

Done when: 両browser laneでフレーム表示が正しく、canvas/WebGL context/settlementに回帰がない。

## Phase 5 — 最終監査とcommit

- [x] `git diff --check`、task-owned diff、生成物/mirror差分を確認する。
- [x] 仕様、catalog、headless rules、CPU/network authorityが未変更であることを確認する。
- [x] 計画書をcompleteへ更新する。
- [x] task-owned fileだけをcommit対象として確定する。

Done when: 検証済みの単一coherent commitが作成され、残存リスクと実行結果を報告できる。

## 自己レビュー

- 実装順はmodel contractを先に固定し、その後consumerとCSSを切り替えるため、途中で推測ロジックを増やさない。
- regression testはunit/CSS/browserの三層で原因・契約・実結果をそれぞれ覆う。
- 生成物はroot sourceを直接編集せず、focused verification後に既存scriptで更新する。
- network/card ruleには触れないため、network parity full bundleは原則不要だが、inventoryとdiffで境界逸脱がないことを最終確認する。

## 検証結果

- `npm run typecheck`: pass
- focused Jest（frame presenter、model、Pixi scene、backend selection、DOM compatibility）: pass
- 実カードE2E（盤面拡張、盤面拡張神）: pass
- backend E2E（拡張後の画像フレーム、初期欠け盤面のCSS輪郭、Pixi/DOM）: pass
- `npm run match:pixijs-board-static-check`: pass（classic/Vite、DPR 1/2、76件）
- `npm run match:pixijs-board-playback-check`: pass（12レポート、208シナリオ）
- `npm run match:pixi-runtime-fallback-check`: pass（初回はWindows error 1224で生成物書き込みが一時失敗し、再実行で成功）
- `npm run check:board-test-selectors`: pass（通常/Pixi違反0）
- `npm run build:browser`, `npm run build:vite`, `npm run worker:prepare`: pass
- `npm run test:jest`: pass（960 suites / 6,794 tests）
