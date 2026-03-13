# カードオセロ / AGENTS.md

最終更新: 2026-03-13

このファイルは作業の段取りです。強制ルールは `.github/copilot-instructions.md` ですが、下記の「共通ルール」は両ファイルで同一に保ちます。

## カスタマイズmdの役割分担

- `.github/copilot-instructions.md` と `AGENTS.md` は意味差を広げない。違いは入口と導線だけに留める。
- `.github/copilot-instructions.md` は常時効く制約、完了条件、境界ルールを優先して書く。
- `AGENTS.md` は読む順、調査順、編集順、確認順を優先して書く。
- `.github/instructions/*.instructions.md` は `applyTo` で効く局所ルールだけを書く。
- `.github/agents/*.agent.md` と `.github/skills/**/SKILL.md` は特定作業の進め方に絞り、仕様や強制ルールを重複定義しない。

## 重要: 片方しか読まれない場合の共通ルール（衝突防止）

- この節は `.github/copilot-instructions.md` の同名節と同じ内容を保つ。
- エージェントがどちらか片方だけを読んだ場合でも、この節の内容を最優先で適用する。
- 2つのファイルで文言差が出た場合は、より厳しい方を採用する。
- 外部のコード保管先への送信、外部確認前提の提案、外部依存の追加はしない（外部依存は事前合意がある時だけ）。
- 仕様の一次情報は `01-rulebook.md` とし、挙動が変わる実装変更では `01-rulebook.md` を更新する。
- `game/` は `ui/` に直接依存しない。`ui/` は `game/` の公開入口だけを使う。
- `cpu/` は読み取り専用で扱い、DOM/UI/音/タイマーを直接操作しない。
- 値の揺れ（`owner` / `player` / 色）は入口でそろえ、内部表現を統一する。
- 修正は根本原因を先に特定し、修正前後で同条件の確認結果を残す。
- この節を更新したら、同じ変更を `.github/copilot-instructions.md` の同名節にも反映する。

## 指示の優先順位（衝突時は上が勝つ）

1) 仕様（一次情報）: `01-rulebook.md`（末尾の UI/演出仕様を含む）  
2) 共通ルール（このファイルと `.github/copilot-instructions.md` の同名節）  
3) 対象別の追加指示: `.github/instructions/*.instructions.md`（`applyTo` 範囲のみ）  
4) タスク別の導線: `.github/agents/*.agent.md`, `.github/skills/**/SKILL.md`
5) 補助ガイド: `cards/README.ai.md` など各ディレクトリの `README.ai.md`

## 共通実行ルール（Codex/Copilot 同一）

- ローカル完結を徹底する（外部送信・外部レビュー前提・外部同期前提の提案をしない）。
- 変更は差分最小で行い、まず根本原因を特定してから修正する。
- 修正前後で同条件の確認結果（ログ/テスト）を残す。
- 挙動や見え方が変わる実装変更は `01-rulebook.md` を更新する。
- `owner` / `player` / 色などの値は入口で正規化し、内部表現を混在させない。
- 定数は `shared-constants.js` と `constants/` を単一ソースとし、重複定義しない。
- デバッグ動作は `?debug=1` 等で明示的に有効化し、通常時に副作用を出さない。
- 質問で停止するのは最小限にする（仕様矛盾 / 破壊的変更 / 外部依存 / 好みが分かれる選択のみ）。

## UI/演出の必須ルール

- UI は `events[]` を順番通りに再生する（推測補完しない）。
- 再生中に盤面 DOM を更新する書き手は 1 つに限定する（Playback Engine）。
- フリップは Spec B（見た目を先に最終状態へ寄せてからモーション）を守る。
- 演出は `ui/animation-*` と `ui/stone-visuals.js` に集約する。

## フォルダ別追加指示

- `.github/instructions/*.instructions.md` の `applyTo` を守る。
- 対象: `game/`, `ui/`, `cpu/`, `cards/`, `constants/`, `debug`。

## 作業フロー（最短）

1) 目的と影響範囲（関連ファイル/テスト）を決める。  
2) 仕様変更が必要なら `01-rulebook.md` を先に直す。  
3) 実装は既存の共通経路を再利用し、コピペ分岐を増やさない。  
4) 変更範囲に応じてテスト/チェックを実行する。  
5) 差分と確認結果を短く説明して完了する。

## 完了条件（強制）

- 変更範囲のテストを実行し、結果を報告する（例: `npm test`, `npm run test:jest:changed`）。
- `01-rulebook.md` の更新有無を最終報告に必ず書く。
- `01-rulebook.md` を更新しない場合は、不要理由を最終報告に必ず書く。
- 上記が満たされない場合は完了扱いにしない。

## 返信

- 最後に、専門用語を避けた短い説明を付ける。
