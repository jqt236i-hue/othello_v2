# 盤面拡張マスへ石を置く入力 実装計画

- Status: active
- Date: 2026-08-22
- Design: `docs/implementation/board-expansion-placement-input-design.md`

## Phase 1 — ポインタ根を canvas 層へ移す

- [x] `ui/pixi/board-input.ts` の mount に pointer root を追加し、生産経路では document 捕捉で native down/move/up/cancel を付ける。
- [x] `ui/pixi/board-backend.ts` が document を native pointer root として渡す。
- [x] `ui/pixi/camera.ts` と `styles-board.css` で canvas 層を `pointer-events: auto` にする。
- [x] press 中は pointer capture し、gutter 外で放しても up/cancel が欠けるのを防ぐ。

Verification: `test/ui.pixi-board-input.test.ts`、`test/ui.pixi-board-backend.test.ts`。

Done when: viewport 外（canvas gutter）の native pointer が 1 本の入力経路で `handlePointer` に届く。

## Phase 2 — 拡張 AABB まで canvas / materialize を伸ばす

- [x] camera が現存する拡張セルのベース矩形外 AABB から左右上下 gutter を計算する。
- [x] `materializeBoardViewport` が窓外の expansion セルを sparse に含める。
- [x] 既存セル client rect と base viewport 寸法は変えない。

Verification: `test/ui.pixi-camera.test.ts`、`test/ui.board-visual-model.test.ts`。

Done when: 3 マス目の拡張が canvas と materialize に含まれ、2 マス以内では gutter が effect 既定のまま。

## Phase 3 — 契約・CSS・回帰

- [x] `docs/architecture-contracts.md` §7.3 に canvas overlay 入力を追記する。
- [x] CSS contract が canvas `pointer-events: auto` を固定する。
- [x] 入力 controller が拡張座標の hit-test を落とさないことを focused test で固定する。

Verification: 対象 Jest、既存 `test/game.board-expansion-will.test.ts` の合法手ケース。

Done when: 契約文とテストが実装と同じ結果を説明する。

## Phase 4 — 検証と差分監査

- [x] focused Jest、`npm run typecheck`。
- [x] Pixi/CSS 変更後に `npm run build:browser`。
- [x] `git status` で無関係な演出差分を混ぜない。

## Completion checklist

- [x] 拡張マスへポインタが届く。
- [x] 合法なら石を置ける（ルール層は既存）。
- [x] 既存マス位置・縮尺・ベース `#board` 寸法・scrollbar-free を維持。
- [x] 3 マス以上の同方向拡張も描画される。
- [x] design/plan が最終実装と一致する。
- [ ] task-owned 差分だけが残る。

作業ツリーには依頼前からの演出差分（`ui/pixi/effects/move.ts` など）と、`build:browser` が更新する `index*.html` / `public/module-registry.js` が残っている。Worker 鏡 `worker-public/styles-board.css` は未同期。

## Self-review

- 入力修正を先に、gutter/materialize をその次にする。前者だけでも 1〜2 マス拡張は直るが、仕様の「何度でも拡張」には後者が必要。
- 物理枠拡大は計画に含めない。
- コミットはユーザー規則により、依頼があるまで行わない。
