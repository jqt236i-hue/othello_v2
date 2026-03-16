# カードオセロ / AGENTS.md

最終更新: 2026-03-16

## 0. この文書の役割

- この文書は、この repo で作業するときの読む順、調べる順、直す順、確認順をまとめた導線です。
- 仕様は `01-rulebook.md`、強制ルールは `.github/copilot-instructions.md`、局所差分は `.github/instructions/*.instructions.md`、定型作業は `SKILLS.md` と `.github/skills/**/SKILL.md` が担当します。
- ここに書くのは「どう進めるか」です。仕様や hard rule の正本を重複定義しません。

## 最小共通ルール

- 仕様の一次情報は `01-rulebook.md`。挙動や見え方を変える変更は、関連実装より先にここを更新する。
- 外部のコード保管先への送信、外部確認前提の提案、外部依存の追加はしない。事前合意がある場合だけ例外とする。
- `game/` は `ui/` に直接依存しない。`ui/` は `game/` の公開 API / event / DI だけを使う。
- `cpu/` は読み取り専用で扱い、DOM / UI / 音 / タイマーを直接操作しない。
- `owner` / `player` / 色などの揺れは入口で正規化し、内部表現を混在させない。
- 定数は `shared-constants.js` と `constants/` を単一ソースにし、重複定義しない。
- debug 動作は `?debug=1` などの明示条件でだけ有効化し、通常時に副作用を出さない。
- UI は `events[]` を順番どおりに再生し、再生中の盤面 DOM の書き手は 1 つに絞る。フリップ演出は Spec B を守る。
- root を正本にし、`worker-public/` は mirror として扱う。必要時は `npm run worker:prepare` で同期する。
- 既定の実装戦術は差分最小とする。ただし根本原因が構造問題、契約不整合、再発不具合にある時は、master plan / phase / 完了条件 / 検証束を先に固定し、段階的な大幅改革を選んでよい。
- 修正は根本原因を先に特定し、前後で同条件の確認結果を残す。
- この共通節を更新する時は `AGENTS.md` と `.github/copilot-instructions.md` の両方に同じ内容を入れる。

## 読む順

1. 挙動や見た目が絡むなら `01-rulebook.md`
2. hard rule が必要なら `.github/copilot-instructions.md`
3. 触るファイルに対応する `.github/instructions/*.instructions.md`
4. 反復作業や広い作業なら `SKILLS.md` と対応する `.github/skills/**/SKILL.md`
5. 局所事情だけ必要なら対象ディレクトリの `README.ai.md`

## 着手前に決めること

- 目的、影響ファイル、更新が必要な仕様面を先に固定する。
- 今回が局所修正か、構造改革かを先に分類する。構造改革なら master plan を先に置く。
- root 正本ファイルと、生成物 / mirror を切り分ける。
- 先に関連 test / check / search を決め、変更後に同条件で見直す。
- 同じ箇所に未コミット変更がある時は、上書き可否を明示してから触る。

## 調査順の基本

1. 仕様または外部契約
2. root 側の公開入口
3. 既存の共通 helper / 定数 / 生成経路
4. 関連 test
5. `worker-public/` や deploy などの派生面

## 代表的な入口

- UI / load order: `index.html`, `ui/bootstrap.js`, `ui/handlers/init.js`
- ゲーム進行: `game/turn/*`, `game/turn-manager.js`, `game/move-executor.js`
- カード: `cards/catalog.json`, `game/logic/cards.js`, `game/card-effects/*`
- CPU: `game/cpu-decision.js`, `game/cpu-turn-handler.js`, `game/ai/*`
- network client: `ui/network-client.js`, `ui/network/snapshot.js`, `ui/network/session-seat.js`
- network backend: `workers/match-worker.mjs`, `scripts/local-match-server.js`, `scripts/match-network-smoke.js`
- worker-public sync: `scripts/prepare-worker-assets.js`, `worker-public/*`

## 編集順

1. 仕様変更が必要なら `01-rulebook.md` を先に直す。
2. 局所修正なら root 側の正本を最小差分で直す。
3. 構造問題なら master plan / phase / 完了条件 / 検証束を先に固定し、延命 patch ではなく置換境界を決めて進める。
4. 生成物や mirror は最後に揃える。
5. rename / delete は残り参照を検索してから確定する。
6. 無関係な掃除を同じ差分に混ぜない。

## 確認順

- docs-only でなければ、変更範囲の近い test / check から先に回す。
- docs-only なら、役割の重複、参照漏れ、frontmatter / `applyTo` / file existence を確認する。
- `worker-public/` に影響がある時は `npm run worker:prepare` を含める。
- 削除や統合をした時は `rg` で残り参照を消したことを確認する。

## 完了報告

- 何を変えたか
- なぜその置き場所にしたか
- 実行した test / check と結果
- `01-rulebook.md` を更新したかどうかと理由
- 専門用語を避けた短い説明

## 止まる条件

- 仕様矛盾があり、正しい挙動を決められない
- 破壊的変更や新規依存追加が必要
- root 正本を決められない
- 未承認の同一箇所変更で上書きリスクが高い
