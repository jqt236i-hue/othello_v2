# ブラウザ起動不能 復旧マスタープラン

**作成日**: 2026-05-02  
**対象**: `game/`, `dist/`, `public/module-registry.js`, `worker-public/`, `scripts/`  
**状態**: 計画確定前  
**起票理由**: ゲームが正常起動せず、盤面初期化前にブート連鎖が崩れる

---

## 0. この文書の位置づけ

- この文書は、2026-05-02 時点で発生している「ゲームが正常に起動できない」不具合を、root 正本から復旧するための master plan である。
- 一次仕様は `01-rulebook.md`、内部契約は `docs/architecture-contracts.md`、進め方は `AGENTS.md` に従う。
- 今回の主眼は仕様変更ではなく、壊れた正本ソースと派生生成物の復旧、検証束の再整備、再発防止である。
- `worker-public/` は mirror であり、直接修正完了扱いにしない。復旧は必ず root 正本から行う。

## 1. 事象要約

現時点のログと調査では、起動失敗は単一の UI 崩れではなく、ブート対象モジュールの破損が連鎖した結果と判断する。

- `entry-browser.js` が `dist/game/logic/cards/utils` などの読込で `skip` を出す
- `CoreLogic` / `CardLogic` / `SeededPRNG` が揃わず、初期化が継続不能になる
- `resetGame` が `p.shuffle is not a function` で落ちる
- 画面は部分描画されるが、盤面・手番・カード系の正規初期化は成立しない

## 2. 根本原因の暫定結論

今回の root cause は、起動順の偶発的不整合よりも、**root 側の正本ソース破損**である。

確認済みの主な破損候補:

- `game/logic/cards/utils.ts`
- `game/logic/cards/breeding.ts`
- `game/logic/cards/sniper.ts`
- `game/logic/cards/lightning.ts`
- `game/logic/cards/destroy_dragon.ts`
- `game/logic/cards/work_will.ts`
- `game/move-executor-visuals.ts`

確認済みの症状:

- ファイル内容が途中断片だけになっている
- `export = xxx` だけ残り、本体定義がない
- `getMoveExecutorVisuals` を export しているのに定義が存在しない
- 壊れた root 正本が `dist/` と `worker-public/` に伝播している

暫定的に、直近の TypeScript 移行・整理コミットで不完全変換が入り、その内容がそのまま現行正本になっている可能性が高い。

## 3. 目的

- ブラウザでゲームが正常起動し、盤面初期化とリセットが通る状態へ戻す
- 破損した root 正本を復旧し、`dist/` と `worker-public/` を正規経路で再生成する
- ブート失敗を `try/catch skip` に埋もれさせず、必要モジュール欠落を検知できる状態へ寄せる
- 同種事故が再発しないよう、最低限の検証束と生成物整合チェックを追加する

## 4. 非目標

- ゲームルール変更
- カード効果の再設計
- UI デザイン刷新
- network authority 契約の変更
- TypeScript 移行全体のやり直し

## 5. 進め方の原則

- root 正本の復旧を先に行い、`dist/` や `worker-public/` の局所修正で済ませない
- 破損箇所は「差分の小ささ」より「正しい canonical source の回復」を優先する
- 復旧元は `git` 履歴、repo 内の `.restored` 退避ファイル、既存 JS 正本の順で採用する
- 仕様が変わらない限り `01-rulebook.md` は更新しない
- 修正後は browser 起動確認だけでなく、生成経路と mirror 同期まで確認する

## 6. フェーズ計画

### Phase 0: 復旧元の固定

**目的**: 復旧対象と復旧元を先に固定し、途中で正本が揺れないようにする。

**タスク**:

1. 破損ファイル一覧を確定する
2. 各ファイルごとに復旧元を決める
3. `git` 履歴と `.restored` のどちらを正本根拠に使うか記録する
4. `dist/` と `worker-public/` は root 復旧後に作り直す対象として明示する

**完了条件**:

- 対象ファイルと復旧元の対応表が確定している
- root 正本 / 派生物 / mirror の区別が明文化されている

### Phase 1: root 正本の復旧

**目的**: 起動に必要な最小モジュール群を root 側で正しい内容に戻す。

**優先対象**:

1. `game/logic/cards/utils.ts`
2. `game/move-executor-visuals.ts`
3. `game/logic/cards/breeding.ts`
4. `game/logic/cards/sniper.ts`
5. `game/logic/cards/lightning.ts`
6. `game/logic/cards/destroy_dragon.ts`
7. `game/logic/cards/work_will.ts`

**タスク**:

1. 旧 JS 正本または退避内容から TS 正本を復元する
2. export だけ残って本体がない状態を解消する
3. `move-executor-visuals` の公開 API を実装実態と一致させる
4. 復旧後に局所 require / import 解決を確認する

**完了条件**:

- 対象ファイルが断片ではなく、自己完結した正本として成立する
- `rg` で対象関数の未定義 export が残っていない
- `tsc --noEmit` か同等のローカル確認で致命的構文エラーがない

### Phase 2: 派生物の再生成

**目的**: root 正本の復旧内容を `dist/` と browser 読込資産へ正規反映する。

**タスク**:

1. TypeScript ビルドで `dist/` を再生成する
2. `public/module-registry.js` を再生成する
3. `entry-browser.js` と関連ブート資産の整合を確認する
4. `npm run worker:prepare` で `worker-public/` を同期する

**完了条件**:

- `dist/` の対象モジュールが root と同じ責務を持つ状態で再生成されている
- `worker-public/` が root から再同期されている
- 破損断片が `dist/` / `worker-public/` に残っていない

### Phase 3: 起動検証と回帰確認

**目的**: 実際にブラウザ起動が回復したことを、同条件で確認する。

**タスク**:

1. `?debug=1` 付きで通常起動し、盤面描画と初期化完了を確認する
2. リセット操作後も再初期化が通ることを確認する
3. コンソールの致命的エラーが消えたことを確認する
4. 最低限の関連 Jest / smoke を実行する

**完了条件**:

- 起動時に盤面と手札の初期化が成立する
- `CoreLogic is not loaded`
- `CardLogic is not loaded`
- `SeededPRNG is required but not available`
- `p.shuffle is not a function`

上記の致命ログが再現しない

### Phase 4: 再発防止

**目的**: 同種の「断片 TS 正本がそのまま採用される」事故を検知可能にする。

**候補タスク**:

1. browser boot smoke を現行 `serve` 契約に合わせて修正する
2. `entry-browser.js` の `skip` を許容する対象と、即 fail にすべき対象を分ける
3. `scripts/build-module-registry.ts` 周辺に最低限の整合チェックを追加する
4. 特定モジュールで「export される識別子が定義済みか」を確認する静的チェックを追加する

**完了条件**:

- 復旧対象だった種類の破損を CI 相当のローカル検証で検出できる
- smoke が現行の `serve` 出力と整合している

## 7. 検証束

docs-only ではなく復旧作業なので、少なくとも以下を束で回す。

### 7.1 局所確認

- 破損対象ファイルの構文確認
- `rg` による未定義 export / 残り断片の確認
- `git diff` による root 正本の復旧差分確認

### 7.2 ビルド・生成

- `npm run build:ts`
- module registry 再生成コマンド
- `npm run worker:prepare`

### 7.3 起動確認

- ローカル起動
- `?debug=1` 付きブラウザ確認
- リセット操作確認

### 7.4 代表回帰

- 起動周辺の smoke
- カード初期化に触る Jest
- 必要なら `move-executor-visuals` 利用箇所の関連テスト

## 8. リスク

- 復旧元の JS と現在の TS 周辺 API が完全一致しない可能性がある
- `move-executor-visuals` は UI 注入境界を含むため、単純復元だけでは現行 bootstrap とズレる可能性がある
- 破損ファイルが今回確認分以外にも存在する可能性がある
- 現在の smoke スクリプト自体に `serve` 契約ずれがあり、検証束も先に手当てが必要になる可能性がある

## 9. 完了条件

この計画の完了は、次をすべて満たした時だけ成立する。

1. root 正本の破損ファイルが復旧している
2. `dist/` と `worker-public/` が root から再生成されている
3. ブラウザでゲームが正常起動する
4. 初期化とリセットが通る
5. 起動阻害ログが消えている
6. 復旧後の検証束が green である
7. `01-rulebook.md` の更新要否を完了報告で明示できる

## 10. 完了報告で必ず書くこと

- 何を root 正本として復旧したか
- どの復旧元を採用したか
- `dist/` と `worker-public/` をどう再生成したか
- 実行した確認コマンドと結果
- `01-rulebook.md` を更新したかどうかと理由

