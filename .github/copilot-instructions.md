# カードオセロ / Copilot instructions

最終更新: 2026-04-04

## 0. この文書の役割

- この文書は、この repo で常時有効にしたい hard rule と完了条件だけを置く場所です。
- 仕様は `01-rulebook.md`、作業導線は `AGENTS.md`、局所差分は `.github/instructions/*.instructions.md`、定型作業は `SKILLS.md` と `.github/skills/**/SKILL.md` が担当します。
- ここでは「必ず守ること」だけを定義し、読む順や長い実務手順は書きません。

## 優先順位

1. `01-rulebook.md`
2. このファイル
3. `docs/architecture-contracts.md`
4. `AGENTS.md`
5. `.github/instructions/*.instructions.md`
6. `SKILLS.md`, `.github/skills/**/SKILL.md`, `.github/agents/*.agent.md`, `README.ai.md`

## 最小共通ルール

- 仕様の一次情報は `01-rulebook.md`。挙動や見え方を変える変更は、関連実装より先にここを更新する。
- 外部のコード保管先への送信、外部確認前提の提案、外部依存の追加はしない。事前合意がある場合だけ例外とする。
- `game/` は `ui/` に直接依存しない。`ui/` は `game/` の公開 API / event / DI だけを使う。
- `cpu/` は読み取り専用で扱い、DOM / UI / 音 / タイマーを直接操作しない。
- `owner` / `player` / 色などの揺れは入口で正規化し、内部表現を混在させない。
- 定数は `shared-constants.js` と `constants/` を単一ソースにし、重複定義しない。
- debug 動作は `?debug=1` などの明示条件でだけ有効化し、通常時に副作用を出さない。
- ユーザー向けの説明では、カード名・効果名・状態名・UI要素名を、まず `01-rulebook.md` や画面表示に沿った日本語名 / 表示名で書く。コード上のID・関数名・event type は必要な時だけ補足として併記する。
- UI は `events[]` を順番どおりに再生し、再生中の盤面 DOM の書き手は 1 つに絞る。フリップ演出は Spec B を守る。
- root を正本にし、`worker-public/` は mirror として扱う。必要時は `npm run worker:prepare` で同期する。
- 既定の実装戦術は、根本原因を最も明快に解消し、責務境界・契約・単一ソースを改善できる経路を選ぶこととする。
- 差分の小ささは目的ではない。同等に正しい案が複数ある場合の比較要素としてのみ扱う。
- 局所修正で十分ならその責務境界で完結させる。ただし責務の混線、契約不整合、重複経路、再発不具合がある時は、master plan / phase / 完了条件 / 検証束を先に固定し、抽出・統合・置換を含む構造変更を選ぶ。
- 修正は根本原因を先に特定し、前後で同条件の確認結果を残す。
- この共通節を更新する時は `AGENTS.md` と `.github/copilot-instructions.md` の両方に同じ内容を入れる。

## 文書の役割分担

- `01-rulebook.md`: ゲーム仕様、カード仕様、UI / 演出の見た目上の仕様、外に見える契約だけを書く。
- `.github/copilot-instructions.md`: 常時有効の hard rule と完了条件だけを書く。
- `docs/architecture-contracts.md`: モジュール境界、ランタイム契約、authority・DI・state 契約など内部アーキテクチャ契約だけを書く。
- `AGENTS.md`: 読む順、調べる順、直す順、確認順だけを書く。
- `.github/instructions/*.instructions.md`: 対象ディレクトリ専用の差分ルールだけを書く。
- `SKILLS.md`: skill の索引と選び方だけを書く。
- `.github/skills/**/SKILL.md`: 個別ワークフローだけを書く。
- `.github/agents/*.agent.md`: 役割、禁止事項、出力契約だけを書く。
- `README.ai.md`: 局所ディレクトリの補助メモだけを書く。

## 強制ルール

- ローカル完結を徹底し、外部送信や外部レビュー前提の運用を組み込まない。
- 症状だけではなく根本原因を直す。仕様変更があるなら `01-rulebook.md` を先に更新する。
- 既存の共通経路、共通 helper、共通定数を再利用し、コピペ分岐を増やさない。
- broad catch、無言 return、success-shaped fallback で不具合を隠さない。
- `window` / `globalThis` への新規公開は最小限にする。
- `worker-public/` を直編集で正本化しない。root を直してから mirror をそろえる。
- 特殊 md の整理であっても、仕様変更を `01-rulebook.md` の外へ隠して書かない。

## 完了条件

- docs-only を除き、変更範囲の test / check を実行して結果を報告する。
- docs-only でも、役割重複、参照漏れ、frontmatter / `applyTo` / file existence を確認する。
- `01-rulebook.md` を更新したかどうかを必ず報告し、更新しない場合は不要理由を書く。
- `worker-public/` を同期した場合は `npm run worker:prepare` を実行したことを報告する。
- 最後に、画面表示や `01-rulebook.md` に沿った日本語名を優先し、専門用語を避けた短い説明を付ける。

## ここに書かないこと

- 長い調査手順や読む順
- タスク別の詳細ワークフロー
- 局所ディレクトリだけに効く注意事項
