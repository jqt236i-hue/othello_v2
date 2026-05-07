# Draft: TypeScript移行最適解分析

## 調査日時
2026-05-07

## 現状サマリ

### 完了済み（R1-R4解消）
- `game.guard-will.test.js`: 11/11 PASS ✅
- `game.position-swap-will.test.js`: 6/6 PASS ✅
- UI source-sibling `.js` import: 0件 ✅
- Jest/ts-jest module解決: 安定 ✅
- `npm run typecheck`: PASS ✅
- `npm run build:ts`: PASS ✅
- `npm run checkall`: PASS ✅（JS inventory gate含む）
- `npm run worker:prepare`: PASS ✅

### 残存JSファイル内訳（合計425件）
| 分類 | 件数 | 主な場所 | 対応要否 |
|------|------|----------|----------|
| dist-wrapper | 348 | 全領域 | 不要（互換性維持） |
| generated | 3 | cards/, shared/ | 不要（生成物） |
| legacy-implementation | 22 | scripts/（ブート/デバッグ/検証） | 要検討 |
| unknown | 52 | scripts/, game/src/types/, src/ 等 | 要調査 |

### 注目ファイル
- `cards/catalog.js` (835行, unknown): 対応TSがあるか要確認
- `scripts/boot-*.js` (複数, legacy): Node.jsブートスクリプト
- `game/src/types/*.js` (複数, unknown): 小さな型定義ファイル

## 選択肢

### A. 「凍結・監視」モード（推奨）
- 現状を「TS移行完了」と宣言
- 残存JSを許容リストとして文書化
- 新規legacy-implementation増殖を防ぐゲート維持
- 最小工数、運用継続

### B. 「scripts/正本化」モード
- scripts/下の22件legacy-implementationをTS化
- unknown 52件の調査・分類
- 中規模作業

### C. 「完全TS化」モード
- すべてのJSを消す（dist-wrapper含む）
- ブラウザ起動/Jest/Nodeスクリプトの構成変更
- 大規模・高リスク

## 推奨
選択肢A + unknownのうち大きなファイル（cards/catalog.js）だけ調査・対応
