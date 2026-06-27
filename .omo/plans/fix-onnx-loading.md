# Plan: ONNX Runtime 読み込みフォールバック修正

## TL;DR

> **Quick Summary**: `game/ai/policy-onnx-runtime.ts` が `_require('onnxruntime-web')` でモジュール読み込みを試みるが、ONNX は `<script>` タグでグローバル変数 `window.ort` として読み込まれているため失敗する。`window.ort` へのフォールバックを追加する。
>
> **Deliverables**:
> - `game/ai/policy-onnx-runtime.ts` に `window.ort` フォールバックを追加
> - `dist/game/ai/policy-onnx-runtime.js` に同内容を反映（tsc で自動生成、または直接編集）
> - `public/module-registry.js` を再生成（`node dist/scripts/build-module-registry.js`）

> **Estimated Effort**: Quick（3行追加＋再生成）
> **Parallel Execution**: NO — シーケンシャル

---

## Context

### 問題
- `policy-onnx-runtime.ts:305` で `_require('onnxruntime-web')` が実行される
- `onnxruntime-web` は `index.html` で `<script src="node_modules/onnxruntime-web/dist/ort.min.js">` として読み込まれ、`window.ort` にグローバル公開されている
- CJSモジュールレジストリには登録されていないため、requireは常に失敗する
- 結果として `_ort` が `null` → `resolveOrtApi()` が `null` → ONNXモデル未ロード → フォールバックAIで動作

### 症状
- コンソールに `[CPU] onnx model unavailable: onnxruntime-web is not available` の警告
- Lv4〜Lv6のCPUがONNX非対応の簡易AIにフォールバックする
- ゲームプレイ自体は問題なし

---

## Work Objectives

### Core Objective
`window.ort` が存在する場合にそれを `_ort` として使えるようにする。

### Concrete Deliverables
1. `game/ai/policy-onnx-runtime.ts` にフォールバック処理を追加
2. `dist/game/ai/policy-onnx-runtime.js` を更新
3. `public/module-registry.js` を再生成

### Must Have
- `resolveOrtApi()` が `window.ort` を見つけて ONNX 推論セッションを作成できること

### Must NOT Have
- サーバーサイド（Node.js）での動作に影響を与えないこと（`window` が undefined の場合はスキップ）

---

## TODOs

- [x] 1. `game/ai/policy-onnx-runtime.ts` に `window.ort` フォールバックを追加

  **What to do**:
  `game/ai/policy-onnx-runtime.ts` の L304-305 の後に、以下のフォールバックを追加する：

  ```typescript
  let _ort: any = null;
  try { _ort = _require('onnxruntime-web'); } catch (e) { /* ignore */ }
  // ★ 追加: onnxruntime-web は <script> タグで window.ort として読み込まれている
  if (!_ort && typeof window !== 'undefined' && (window as any).ort) {
      _ort = (window as any).ort;
  }
  ```

  **Recommended Agent Profile**: `quick`

- [x] 2. `dist/game/ai/policy-onnx-runtime.js` を更新（`npx tsc` で自動生成）

  **What to do**:
  `npx tsc` を実行して TypeScript をコンパイルし、dist ファイルを生成する。
  または、`dist/game/ai/policy-onnx-runtime.js` の対応位置（L363付近）に同じフォールバックを直接編集する。

  **Recommended Agent Profile**: `quick`

- [x] 3. `public/module-registry.js` を再生成

  **What to do**:
  `node dist/scripts/build-module-registry.js` を実行し、更新された `policy-onnx-runtime` モジュールをレジストリに反映する。

  **Recommended Agent Profile**: `quick`

- [x] F1. 動作確認（コンソールに onnxruntime-web is not available の警告が出なくなった ✅）

  **What to do**:
  1. `node --check dist/game/ai/policy-onnx-runtime.js` で構文確認
  2. ブラウザをリロードし、コンソールでエラーが出ていないことを確認
  3. `window.ort` が存在し、ONNXモデルが読み込まれることを確認

  **QA Scenarios**:
  ```
  Scenario 1: window.ort が利用できる
    Tool: ブラウザコンソール
    Steps:
      1. ページリロード
      2. typeof window.ort → "object"
      3. コンソールに "onnxruntime-web is not available" が出ていないことを確認
  ```

---

## Commit Strategy
- **1-3**（同一コミット）: `fix(ai): fallback to window.ort for onnxruntime-web loading`

---

## Success Criteria
- [ ] `window.ort` を使って ONNX 推論セッションが作成される
- [ ] Lv4〜Lv6 CPU が ONNX モデルベースの思考を行う
- [ ] コンソールに onnxruntime-web 関連の警告が出ない
