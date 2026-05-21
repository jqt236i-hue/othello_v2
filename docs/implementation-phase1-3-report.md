# Phase 1-3 実装完了報告（最終版）

## 実装概要
カードリバーシAI学習システムのPhase 1〜3にわたる改善を完全に実装しました。

## 新規ファイル（21個）

### Phase 1: 基礎改善
- `ai/train/models/hand_encoder.py` — 手札エンコーダ（Card ID embedding + DeepSets aggregator）
- `ai/train/models/cnn_resnet_policy_v2.py` — CNN+ResNet v2（WDLヘッド + 手札統合 + **T=8履歴対応**）
- `ai/train/losses/asymmetric_loss.py` — Asymmetric Loss（ASL）
- `game/ai/gumbel-mcts.js` — Gumbel AlphaZero MCTS（Sequential Halving）
- `game/ai/policy-onnx-runtime-v2.js` — 3入力ONNXランタイム（board/aux/hand）
- `scripts/sprt.js` — SPRT（逐次確率比検定）
- `scripts/benchmark-policy-adoption-sprt.js` — SPRT評価ゲート
- `scripts/benchmark-browser-inference.js` — ブラウザ推論ベンチマーク

### Phase 2: 中核強化
- `game/ai/mcts-two-layer.js` — 2層MCTS（カード選択+配置探索）
- `ai/train/models/card_characteristics.py` — DeNA式カード特性ベクトル
- `ai/train/swa_trainer.py` — SWA（Stochastic Weight Averaging）
- `game/ai/mcts-temperature.js` — KataGo式温度管理・RPC・Diversity
- `scripts/curriculum-scheduler.js` — 4ステージカリキュラム学習

### Phase 3: 革新的変更
- `ai/train/models/alpha_vit.py` — AlphaViT（Vision Transformer）
- `ai/train/models/mamba_block.py` — CNN+Mambaハイブリッド
- `game/ai/endgame-solver.js` — 終盤完全読みソルバー（Minimax+Alpha-Beta）
- `ai/train/batch_selfplay.py` — GPUバッチ自己対局

### テストファイル（4個）
- `ai/train/tests/test_cnn_resnet_policy_v2.py` — CNN v2モデルテスト（履歴対応含む）
- `ai/train/tests/test_hand_encoder.py` — 手札エンコーダテスト
- `ai/train/tests/test_asymmetric_loss.py` — ASLテスト
- `ai/train/tests/test_card_characteristics.py` — カード特性ベクトルテスト
- `game/ai/__tests__/test-gumbel-mcts.test.js` — Gumbel MCTSテスト
- `game/ai/__tests__/test-endgame-solver.test.js` — 終盤ソルバーテスト
- `scripts/__tests__/test-sprt.test.js` — SPRTテスト

### ユーティリティバッチファイル
- `scripts/smoke-test-cnn-v2.bat` — v2モデルの試験学習
- `scripts/restart-balanced-safe.bat` — 既存学習のシングルスレッド再開
- `scripts/integration-test-phase1.bat` — Phase 1統合テスト

## 編集ファイル（2個）
- `ai/train/train_policy_onnx_v2.py` — WDLヘッド・手札エンコーダ・nonvalidityペナルティ・**T=8履歴統合**
- `game/ai/mcts-policy.js` — Gumbel AlphaZero対応

## T=8盤面履歴統合詳細

### モデル変更（`cnn_resnet_policy_v2.py`）
- `HistoryBoardEncoder` クラスを追加: (N, T, 5, 10, 10) → (N, 10, 10, 10) に畳み込み圧縮
- `CnnResNetPolicyV2` に `history_length` パラメータを追加
- 後方互換性維持: `history_length=1` の場合は従来通りの動作

### 学習スクリプト変更（`train_policy_onnx_v2.py`）
- `DatasetBundle` に `x_history` フィールドを追加
- `build_board_tensor_with_history()` 関数を追加
- `load_dataset()` で `boardHistory` フィールドをチェック（既存データ互換）
- `train_model()` で履歴データの train/val 分割と forward への渡しを実装
- `export_onnx()` で履歴入力がある場合は4入力ONNXをエクスポート

### データ形式
NDJSONの各行にオプションで `boardHistory` フィールド（長さTの配列）を追加:
```json
{
  "board": "...",
  "boardHistory": ["...", "...", "..."],
  "player": "black",
  ...
}
```

## テスト結果
- **Pythonファイル**: すべて構文OK（py_compile検証済み）
- **JSファイル**: すべて構文OK（node --check検証済み）
- **T=8モデル**: 履歴あり/なしの両方で forward 成功（形状テスト）

## 実行準備完了コマンド

### 統合テスト（Phase 1完走確認）
```batch
scripts\integration-test-phase1.bat
```

### v2モデル試験学習
```batch
scripts\smoke-test-cnn-v2.bat
```

### 既存学習再開
```batch
scripts\restart-balanced-safe.bat
```

### ブラウザ推論ベンチマーク
```bash
node scripts/benchmark-browser-inference.js data/models/policy-net.onnx 100
```

### 単体テスト実行
```bash
# Python tests (requires torch)
cd ai/train && python -m pytest tests/ -v

# JS tests (requires jest)
npx jest --runInBand
```

## 残りの手動確認項目
1. **統合テスト実行**: `integration-test-phase1.bat` でエラーなく学習が完走すること
2. **ブラウザ推論確認**: onnxruntime-web で v2 モデルが正常に読み込めること
3. **既存モデル互換性**: v1 ONNX モデルが従来通り動作すること

## 技術的制約・注意点
- T=8履歴を有効にするには、自己対局データに `boardHistory` フィールドが必要
- 既存データとの互換性のため、履歴がない場合は現在の盤面のみを使用
- 履歴エンコーダはチャンネル数を 5→10 に増加させるため、モデルパラメータがわずかに増加

## KPI目標との比較
| 指標 | Phase 1目標 | 実装状況 |
|------|-------------|----------|
| val_loss | < 4.50 | 未測定（学習実行待ち） |
| val_place_acc | > 0.22 | 未測定（学習実行待ち） |
| val_card_acc | > 0.65 | 未測定（学習実行待ち） |
| 推論レイテンシ(p95) | < 1000ms | ベンチマークツール作成済み |
| モデルサイズ | < 5MB | 軽量設計維持 |

---
**実装日**: 2026-04-27
**対象バージョン**: policy_cnn_onnx.v2
