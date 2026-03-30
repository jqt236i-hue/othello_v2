# コメンタリーシステム（CPU + 勇者発話）段階的リファクタ master plan

作成日: 2026-03-28  
対象: `ui.js`, `ui/presentation-handler.js`, `ui/network/commentary.js`, `ui/bootstrap.js`  
状態: Complete

一次情報: `01-rulebook.md`（ゲーム仕様）、`.github/copilot-instructions.md`（hard rule）、本文書（実行仕様）

---

## 0. この文書の位置づけ

### 0.1 なぜ局所パッチではなくフェーズ制リファクタか

コメンタリーシステムは現在 4 ファイルに**同じ責務が重複分散**している。

- `ui.js` / `ui/presentation-handler.js` / `ui/network/commentary.js` の 3 ファイルが各々、同じ「contextHelpers/runtimeHelpers/cpuCommentaryRuntime の解決ロジック」を個別に実装している（**IPC グルーの三重複**）。
- `ui/bootstrap.js` の `parsePortraitCommentaryLog` がログ文字列を正規表現でパースして再ルーティングする（**log-as-IPC パターン**）。この経路はデバッグが困難で、ログ書式変更が即バグになる。

局所パッチで個別ファイルを直すだけでは重複が残り、次の変更が再び全ファイルに波及する。フェーズ制リファクタを選ぶ理由は以下のとおり。

| 条件 | 該当 |
|---|---|
| 同じ契約を複数ファイルが独自に実装している | ✅ |
| 実装間の不整合が既にバグの温床になっている | ✅ |
| 変更が広いが振る舞いを変えてはならない | ✅ |
| 先にテスト保護を置かないと安全に進められない | ✅ |

---

## 0.2 対象・一次情報

### 0.2.1 主対象ファイル

| ファイル | 役割 | 主な問題 |
|---|---|---|
| `ui.js` | ローカル hero turn コメンタリー発火 | resolver 重複, `buildCommentaryContext` 直呼び |
| `ui/presentation-handler.js` | 盤面更新イベントに連動したコメンタリー発火 | resolver 重複, hero dedupe state が暗黙 |
| `ui/network/commentary.js` | ネットワーク対戦時の相手操作コメンタリー | resolver 重複, CPU speaker prefix fallback が局所 |
| `ui/bootstrap.js` | ログ文字列→ portrait 表示のルーティング | log-as-IPC 正規表現パース (`parsePortraitCommentaryLog`) |

### 0.2.2 整合確認が必要な隣接ファイル（原則書き換え不要）

- `shared/commentary-context-helpers.js` — `buildCommentaryContext` の一次ソース
- `shared/commentary-runtime-helpers.js` — `resolveCommentaryRuntimeFromGlobal` の一次ソース（後述 1.5 参照）
- `game/ai/cpu-commentary-runtime.js` — `requestCommentary` の実装
- `ui/handlers/cpu-policy.js` — CPU ターン判定
- `game/cpu-turn-handler.js` — CPU ターン進行
- 関連テストファイル（`test/` ディレクトリ）

### 0.3 非目標（このプランでやらないこと）

- コメンタリーの**内容・品質・文章**の変更
- AI モデルの差し替えや学習パイプラインの変更
- `game/` 側の純粋ロジックの変更
- ネットワーク権威モデル全体の再設計（別プランで管理）
- `worker-public/` を直編集で正本化すること — 実行時に mirror 対象の `ui/`, `shared/`, `game/`, `index.html` を更新した場合は、root 修正後に `npm run worker:prepare` で同期する。
- `01-rulebook.md` の更新 — 本プランはアーキテクチャ整理のみで**ユーザーから見た挙動を変えない**。振る舞いを変える変更が出た時点で更新要否を判断する。

---

## 1. 確定事実（根拠付き）

### 1.1 IPC グルーの三重複

#### ui.js

```
ui.js:174  _resolveHeroCommentaryRuntime()
ui.js:181  globalThis.CpuCommentaryRuntime の直参照チェック
ui.js:187  require('./game/ai/cpu-commentary-runtime') fallback
ui.js:385  contextHelpers.buildCommentaryContext({ eventType: 'turn_start', ... })
ui.js:407  Promise.resolve(runtime.requestCommentary(context)).then(...)
```

#### ui/presentation-handler.js

```
presentation-handler.js:8   let commentaryContextHelpers = null;
presentation-handler.js:9   let commentaryRuntimeHelpers = null;
presentation-handler.js:11  let cpuCommentaryRuntime = null;
presentation-handler.js:28  resolveCommentaryContextHelpers() — 独自キャッシュ+global+require
presentation-handler.js:41  resolveCommentaryRuntimeHelpers() — 同上
presentation-handler.js:67  resolveCpuCommentaryRuntime()    — 同上
```

#### ui/network/commentary.js

```
network/commentary.js:10-97  createNetworkCommentaryController() 内で同じ resolver を再実装
network/commentary.js:265-284 buildCommentaryContext() を直呼び
network/commentary.js:291     actorKey === 'white' ? '白CPU' : '黒CPU' — speaker prefix が局所計算
network/commentary.js:286     runtime.requestCommentary(context).then(...) — Promise でラップせず直呼び
                               ※ ui.js:407 の Promise.resolve(runtime.requestCommentary(context)).then(...) とは異なる書き方
```

### 1.2 log-as-IPC パターン（ui/bootstrap.js）

```javascript
// ui/bootstrap.js:237-251
function parsePortraitCommentaryLog(text) {
    const raw = String(text || '').trim();
    let match = raw.match(/^(黒|白)CPU:\s*(.+)$/);   // 正規表現 1
    if (match) {
        const playerKey = match[1] === '白' ? 'white' : 'black';
        return { speakerRole: 'cpu', playerKey, line: String(match[2] || '').trim() };
    }
    match = raw.match(/^勇者:\s*(.+)$/);               // 正規表現 2
    if (!match) return null;
    return { speakerRole: 'hero', line: String(match[1] || '').trim() };
}
```

- ログ文字列が portrait 表示の IPC バスとして使われている。
- `黒CPU:` / `白CPU:` / `勇者:` のプレフィックス書式が変わると portrait が無音になる。
- `addLog()` の呼び出し元とポートレート表示の間に**間接経路**があり、テストが困難。

### 1.3 その他の実行時リスク

| リスク | 根拠ファイル:行 |
|---|---|
| リクエスト順序の保証なし（Promise 解決順が非同期） | `ui.js:407`（`Promise.resolve` ラップ）、`network/commentary.js:286`（直 `.then`）|
| ゲーム開始リセットが文字列パターンマッチに依存 | `ui/bootstrap.js:parsePortraitCommentaryLog` |
| hero bubble の lifetime が暗黙（明示的な close タイミング未定義） | `ui/bootstrap.js:258-260` |
| ネットワーク対戦時の CPU speaker prefix が network 側で独立計算 | `network/commentary.js:291` |

### 1.4 先に必要なテスト保護

変更前に以下のガードレールを置かないと大規模変更の安全確認ができない。

1. portrait ライフサイクル（表示 → 発話 → 消去の順序）
2. hero コメンタリーの dedupe（同一 key で重複発火しない）
3. speaker 正規化の一貫性（`playerKey: 'black'/'white'` → prefix 変換）
4. CPU マルチターン状態の分離（前ターンの状態が次ターンに漏れない）

### 1.5 shared/commentary-runtime-helpers.js に既存のヘルパー（確認済み）

`shared/commentary-runtime-helpers.js:84-97` に以下の関数が**すでに存在**する（新規実装は不要）:

```javascript
// :84
function normalizeSpeakerRole(value, fallbackRole) { ... }

// :90
function getSpeakerPrefix(playerKey, speakerRole) {
    if (normalizeSpeakerRole(speakerRole, 'cpu') === 'hero') return '勇者';
    return normalizePlayerKey(playerKey, 'black') === 'white' ? '白CPU' : '黒CPU';
}

// :95
function getCpuSpeakerPrefix(playerKey) {
    return getSpeakerPrefix(playerKey, 'cpu');
}
```

これらは `return` ブロックでも公開済み（`:99-108`）。  
**Phase 2 の broker は prefix 正規化を再実装せず、`shared/commentary-runtime-helpers` の `getSpeakerPrefix` / `getCpuSpeakerPrefix` / `normalizeSpeakerRole` に委譲する。**

---

## 2. 目標アーキテクチャ

### 2.1 リファクタ後の責務境界

```
┌─────────────────────────────────────────────────────────┐
│  shared/commentary-context-helpers.js                    │
│    buildCommentaryContext()  ← 単一ソース               │
│  shared/commentary-runtime-helpers.js                    │
│    resolveCommentaryRuntimeFromGlobal()  ← 単一ソース   │
│    getSpeakerPrefix() / getCpuSpeakerPrefix()  ← 既存   │
│    normalizeSpeakerRole()  ← 既存                       │
└───────────────────┬─────────────────────────────────────┘
                    │ 共通 resolver / prefix helper を注入
         ┌──────────▼──────────────────┐
         │  ui/commentary-broker.js     │  ← 新規（Phase 2）
         │  ・resolver のキャッシュ     │
         │  ・speaker prefix: shared へ委譲（再実装しない）│
         │  ・requestCommentary ラップ  │
         │  ・portrait 直接呼出 API     │
         │  ・config DI で bubble 関数受取│
         └──────┬──────────────────────┘
                │ 統一 API
    ┌───────────┼────────────────┐
    ▼           ▼                ▼
 ui.js    presentation-   network/
          handler.js      commentary.js
  (hero    (board event    (network op
   turn)    commentary)     commentary)
```

### 2.2 log-as-IPC の廃止後

```
Before:
  addLog("黒CPU: <text>")  →  parsePortraitCommentaryLog()  →  showPortraitSpeech()

After (Phase 3):
  commentaryBroker.requestAndShow({ speakerRole: 'cpu', playerKey, line })
  ↓
  showPortraitSpeech() を直接呼出（正規表現パース不要）
```

---

## 3. フェーズ計画

### Phase 0 — テスト保護の設置

**目的**: 大規模変更の前に振る舞いを固定するガードレールを置く。

**主対象**: `test/` 内の新規テストファイル（既存の `test/shared.commentary-runtime-helpers.test.js` などと命名規約を合わせる）

**作業項目**:
1. portrait ライフサイクルの順序テスト（表示→発話→消去）
2. hero コメンタリー dedupe テスト（`lastHeroCardCommentaryKey` の状態分離）
3. speaker 正規化テスト（`'black'` → `'黒CPU'`、`'white'` → `'白CPU'`、`'hero'` → `'勇者'`）
4. CPU マルチターン状態分離テスト（前ターン残存なし）
5. `parsePortraitCommentaryLog` の入出力テスト（廃止前の振る舞いを固定）

**完了条件**:
- 上記 5 項目のテストが新規追加され、現状の実装で全て **pass** すること
- テスト追加時に既存テストを壊していないこと
- `npm test` が全体で通ること

**検証束**:
```powershell
npm test
```

**ロールバック境界**: テストのみ追加。プロダクションコード変更なし。

---

### Phase 1 — resolver の共通化（重複除去）

**目的**: `ui.js` / `presentation-handler.js` / `network/commentary.js` の resolver 重複を共通モジュールに寄せる。

**主対象**:
- `shared/commentary-context-helpers.js` （既存・拡張）
- `shared/commentary-runtime-helpers.js` （既存・拡張）
- `ui.js`（resolver ロジック削除・shared 参照に置換）
- `ui/presentation-handler.js`（同上）
- `ui/network/commentary.js`（同上）

**作業項目**:
1. `shared/commentary-runtime-helpers.js` に `resolveCpuCommentaryRuntime(globalCtx)` を追加（3 ファイルの実装を統合）
2. `ui.js` の `_resolveHeroCommentaryRuntime()` を削除し、`shared` の共通 resolver に置換
3. `ui/presentation-handler.js` の `resolveCommentaryContextHelpers()` / `resolveCommentaryRuntimeHelpers()` / `resolveCpuCommentaryRuntime()` を削除し、`shared` に置換
4. `ui/network/commentary.js` の同等ローカル resolver を削除し、`shared` に置換
5. 各ファイルの先頭コメントに「resolver は shared から取得」と記載

**完了条件**:
- 3 ファイルのローカル resolver 関数が削除されていること
- `shared/commentary-runtime-helpers.js` の `resolveCpuCommentaryRuntime` を単一ソースとして使っていること
- Phase 0 のテストが全て **pass** すること
- `npm test` 全体通過

**検証束**:
```powershell
npm test
node -e "const h = require('./shared/commentary-runtime-helpers'); console.log(typeof h.resolveCpuCommentaryRuntime)"
```

**ロールバック境界**: shared の API 追加と 3 ファイルの内部 resolver 削除のみ。外部 API は変わらない。

---

### Phase 2 — commentary broker の導入

**目的**: `ui/commentary-broker.js` を新設し、requestCommentary ラップ・portrait 直接呼出 API・hero dedupe state を一元化する。speaker prefix は `shared/commentary-runtime-helpers` の既存関数に**委譲**し、再実装しない。

**主対象**:
- `ui/commentary-broker.js` （新規）
- `ui.js`（broker 経由に切り替え）
- `ui/presentation-handler.js`（同上）
- `ui/network/commentary.js`（同上）
- `ui/bootstrap.js`（broker の初期化追加）

**アーキテクチャ決定 — DI 方針**:

`index.html` では `ui/bootstrap.js` が `ui/status-display.js` より先に読み込まれる（`index.html:839`, `index.html:852`）。そのため `installGameDI()` 実行時点では `window.showHeroSpeechBubble` / `window.showCpuSpeechBubble` が未登録の可能性がある。broker は `initBroker(config)` の `config` オブジェクトで **lazy getter** を受け取り、表示時点で解決する。ラッパーは導入しない。

```javascript
config.getShowHeroSpeechBubble()   // => function(line) | null
config.getShowCpuSpeechBubble()    // => function(playerKey, line) | null
```

`speakerRole` に応じて broker が内部で `if (role === 'hero')` と分岐し、`config.getShowHeroSpeechBubble()` / `config.getShowCpuSpeechBubble()` の返値を呼ぶ。  
speaker prefix 計算は `runtimeHelpers.getSpeakerPrefix(playerKey, speakerRole)` に委譲する（1.5 節参照）。

**アーキテクチャ決定 — bootstrap load-order**:

`initBroker()` は `ui/bootstrap.js` の `installGameDI()` 内、依存注入のセットアップが終わった末尾付近で、`_gameDIInstallResult` をセットする直前（実コード基準では `ui/bootstrap.js:786` の直前）に呼ぶ。ここでは bubble 関数を**即値で注入しない**。`getShowHeroSpeechBubble: () => window.showHeroSpeechBubble || null` / `getShowCpuSpeechBubble: () => window.showCpuSpeechBubble || null` を渡し、broker が表示直前に都度取得する。

**作業項目**:
1. `ui/commentary-broker.js` を新規作成:
   - `initBroker(config)` — runtime / contextHelpers / `getShowHeroSpeechBubble` / `getShowCpuSpeechBubble` を config DI で受け取る
   - `requestCommentaryAndShow({ speakerRole, playerKey, context })` — 単一エントリポイント
   - speaker prefix は `shared/commentary-runtime-helpers` の `getSpeakerPrefix` / `getCpuSpeakerPrefix` へ**委譲**（再実装禁止）
   - リクエストキュー or シリアル Promise chain で順序保証
   - `lastHeroCardCommentaryKey` による hero dedupe state をここに移管（`ui/presentation-handler.js` から削除）
   - `resetState()` API — ゲーム開始時に dedupe state をリセット
2. `ui.js` の `_requestLocalHeroTurnCommentary` を broker 経由に切り替え
3. `ui/presentation-handler.js` の commentary 発火を broker 経由に切り替え。`lastHeroCardCommentaryKey` 変数は broker に移管したため削除
4. `ui/network/commentary.js` の commentary 発火を broker 経由に切り替え
5. `ui/bootstrap.js` の `installGameDI()` 末尾（connect チェーン完了後）に `initBroker` 呼出を追加し、`getShowHeroSpeechBubble: () => window.showHeroSpeechBubble || null` / `getShowCpuSpeechBubble: () => window.showCpuSpeechBubble || null` を config で渡す

**完了条件**:
- `ui/commentary-broker.js` が存在し、`initBroker` / `requestCommentaryAndShow` / `resetState` を公開していること
- 3 ファイルの直接 `requestCommentary` 呼出が broker 経由になっていること
- speaker prefix が `shared/commentary-runtime-helpers.getSpeakerPrefix` 経由で計算されていること（broker 内に `黒CPU`/`白CPU`/`勇者` の文字列リテラルがないこと）
- `lastHeroCardCommentaryKey` が `ui/presentation-handler.js` から削除され、broker に一元化されていること
- Phase 0 テスト全通過 + `npm test` 全体通過

**検証束**:
```powershell
npm test
node -e "const b = require('./ui/commentary-broker'); console.log(Object.keys(b))"
npx rg "lastHeroCardCommentaryKey" ui/presentation-handler.js
```

**ロールバック境界**: broker 新規追加と呼出元の切り替えのみ。`ui/bootstrap.js` の parsePortraitCommentaryLog はまだ残す。

---

### Phase 3 — log-as-IPC の廃止

**目的**: `ui/bootstrap.js` の `parsePortraitCommentaryLog` による正規表現ルーティングを削除し、broker の直接呼出に置き換える。

**主対象**:
- `ui/bootstrap.js`
- `addLog()` の呼出元（コメンタリー起点となっている箇所）

**作業項目**:
1. **着手前に** `rg "addLog.*CPU:|addLog.*勇者:" --type js` を実行し、対象箇所の件数を記録する
2. 記録した全箇所を broker API 直接呼出に置換
3. `maybeShowPortraitSpeechFromLog` を `bootstrap.js` から削除
4. `parsePortraitCommentaryLog` を `bootstrap.js` から削除
5. `addLog` を通るコメンタリー経路が 0 件になったことを `rg` で確認

**完了条件**:
- `parsePortraitCommentaryLog` が `ui/bootstrap.js` に存在しないこと
- `maybeShowPortraitSpeechFromLog` が `ui/bootstrap.js` に存在しないこと
- `rg 'parsePortraitCommentaryLog'` の結果が 0 件
- Phase 0 テスト全通過 + `npm test` 全体通過

**検証束**:
```powershell
npx rg "addLog.*CPU:|addLog.*勇者:" --type js
npm test
npx rg "parsePortraitCommentaryLog" --type js
npx rg "maybeShowPortraitSpeechFromLog" --type js
```

**ロールバック境界**: addLog 呼出元の切り替えと bootstrap.js の 2 関数削除のみ。

---

### Phase 4 — クリーンアップと最終検証

**目的**: Phase 1–3 で削除しきれなかった旧インタフェース・未使用変数を除去し、テストを完成させる。`lastHeroCardCommentaryKey` の移管は Phase 2 で完了済み。

**主対象**: 上記全ファイル + `test/` 内テストファイル

**作業項目**:
1. hero bubble の明示的 close タイミングが broker に定義されていることを確認し、未定義ならここで追加
2. ネットワーク CPU ゲーム開始リセットの文字列依存が broker の `resetState()` API に置換されていることを確認
3. 未使用となった変数・関数を削除（`rg` で確認）
4. `test/` 内の既存テスト（`test/shared.commentary-runtime-helpers.test.js` など）に加え、Phase 2 で新設した broker API のテストを `test/` に追加する（ファイル名例: `test/ui.commentary-broker.test.js`）

**完了条件**:
- `npm test` 全体通過
- `rg` で旧 resolver パターン（`resolveCommentaryContextHelpers` など）が 3 対象ファイルに残っていないこと
- `rg` で `parsePortraitCommentaryLog` が 0 件
- lint エラーなし（既存 lint ツールがある場合）

**検証束**:
```powershell
npm test
npx rg "resolveCommentaryContextHelpers|resolveCommentaryRuntimeHelpers|resolveCpuCommentaryRuntime" ui/
npx rg "parsePortraitCommentaryLog|maybeShowPortraitSpeechFromLog" --type js
```

---

## 4. 横断リスクと対策

### 4.1 shared への追加が browser / worker / headless で同じ結果になるか

**リスク**: `shared/` に resolver を追加するとき、`window` / `globalThis` 参照が入ると worker や headless で動かなくなる。  
**対策**: `resolveCpuCommentaryRuntime(globalCtx)` の形で呼出元から context を渡す。`shared/` 側は受け取った object を参照するだけにし、`window` を直参照しない。

### 4.2 Promise 非同期とリクエスト順序

**リスク**: broker のキューが不完全だと、盤面更新→コメンタリー→ポートレート表示の順序が崩れる。  
**対策**: Phase 2 でシリアル Promise chain を必ず実装し、`then` の連鎖で順序を保証する。`Promise.all` は使わない。

### 4.3 addLog 呼出元の探索漏れ

**リスク**: `addLog` 経由でコメンタリーを渡している箇所を見落とすと、Phase 3 後に portrait が無音になる。  
**対策**: Phase 3 着手前に `rg 'addLog.*CPU:|addLog.*勇者:' --type js` で全件確認し、件数を記録してから削除する。

### 4.4 network/commentary.js の CPU speaker prefix fallback

**リスク**: 現行 `ui/network/commentary.js:289-291` は `runtimeHelpers.getCpuSpeakerPrefix` が存在する時はそれを使い、存在しない時だけ `actorKey === 'white' ? '白CPU' : '黒CPU'` の fallback literal を使う。この二重経路が broker 移管中に他の変更と交差すると、shared helper と fallback literal の不整合が再発する。  
**対策**: Phase 2 で broker が `shared/commentary-runtime-helpers.getCpuSpeakerPrefix` を呼ぶ経路を先に確立し、その後 `network/commentary.js` の fallback literal を broker 経由に置換する（Phase 2 の作業項目 1 → 4 の順序を守る）。

### 4.5 テスト保護なしで Phase 1 以降を進める

**リスク**: Phase 0 をスキップすると振る舞いの退行を検出できない。  
**対策**: Phase 0 の全テストが pass するまで Phase 1 に進まない。これは**必須条件**。

---

## 5. 実行順序の理由

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 0 が必須先行: ガードレールなしで shared の変更は安全でない。
Phase 1 が Phase 2 の前提: broker が resolver を使うので、resolver の統一が先。
Phase 2 が Phase 3 の前提: log-as-IPC を削除するには broker 直呼出が先に動いていなければならない。
Phase 4 は Phase 3 の後: 旧コードが全削除されてからクリーンアップする。
```

各 Phase は独立したコミットまたは PR とし、ロールバック境界を明確にする。

---

## 6. 最初にやること・後回しにしてよいこと

### 今すぐやること（Phase 0）

- portrait ライフサイクル / hero dedupe / speaker 正規化 / CPU マルチターン状態のテストを書く。
- `parsePortraitCommentaryLog` の入出力テストを書き、現状の動作を固定する。

**理由**: テストがないと Phase 1 以降の変更が安全かどうか判断できない。

### 次にやること（Phase 1）

- resolver 重複を shared に寄せる。
- これはプロダクションの外部 API を変えないため、リスクが低い。

### 後回しにしてよいこと

- Phase 3 の log-as-IPC 廃止は、broker が安定してから行う。急ぐと portrait が無音になるリスクが高い。
- Phase 4 のクリーンアップは機能的変更なし。他の作業と並行しても影響が小さい。

---

## 7. `01-rulebook.md` の更新要否

本プランはアーキテクチャ整理のみで、ユーザーから見た挙動（どのタイミングで誰が何を話すか）を変えない。  
**現時点では `01-rulebook.md` の更新は不要**。

ただし Phase 2/3 で broker API の設計中に「発話タイミング」や「speaker の種類」を仕様として明文化する必要が生じた場合は、`01-rulebook.md` を先に更新してからコード変更を行うこと。

---

## 8. 完了定義

### 必須条件

- [ ] Phase 0: portrait/dedupe/speaker/CPU 状態テストが全 pass
- [ ] Phase 1: resolver 重複が shared に統一され、3 ファイルのローカル resolver 削除済み
- [ ] Phase 2: `ui/commentary-broker.js` が動作し、3 ファイルが broker 経由で commentary 発火
- [ ] Phase 3: `parsePortraitCommentaryLog` / `maybeShowPortraitSpeechFromLog` が削除済み
- [ ] Phase 4: `npm test` 全体通過 + 旧パターンの `rg` が 0 件
- [ ] 各 Phase のロールバック境界が PR 単位で明確

### 任意条件（将来イテレーション）

- broker に commentary リクエストのキャンセル API を追加
- hero bubble の表示 / 非表示アニメーションを broker で制御
- network / local で同一の broker インタフェースを使い、テストをヘッドレスで完結させる

### 完了宣言手順

1. Phase 4 の検証束が全て pass
2. `rg` で旧 resolver パターンと log-as-IPC 関数が 0 件
3. `01-rulebook.md` の更新要否を確認・報告
4. 本文書の「状態」を `Draft` → `Complete` に変更

---

## 付録 A. テストファイル対応表（Phase 0 追加予定）

既存の `test/` ディレクトリ（`tests/` は存在しない）に追加する。  
`test/shared.commentary-runtime-helpers.test.js` など関連既存ファイルと命名規約を合わせること。

| テスト内容 | 追加先（新規ファイル） |
|---|---|
| portrait ライフサイクル順序 | `test/ui.portrait-lifecycle.test.js` |
| hero dedupe（`lastHeroCardCommentaryKey`） | `test/ui.hero-commentary-dedupe.test.js` |
| speaker 正規化（black/white/hero → prefix） | 既存 `test/shared.commentary-runtime-helpers.test.js` に追記 |
| CPU マルチターン状態分離 | `test/ui.cpu-commentary-state-isolation.test.js` |
| `parsePortraitCommentaryLog` 入出力固定 | `test/ui.parse-portrait-commentary-log.test.js` |

---

## 付録 B. 主要参照箇所まとめ

| 事実 | ファイル:行 |
|---|---|
| resolver キャッシュパターン（3 ファイルで重複） | `ui/presentation-handler.js:8-95` |
| `_resolveHeroCommentaryRuntime` | `ui.js:174-193` |
| `buildCommentaryContext` 直呼び | `ui.js:384-401` |
| `requestCommentary` — `Promise.resolve` ラップあり | `ui.js:407` |
| network resolver 重複（`createNetworkCommentaryController` 本体） | `ui/network/commentary.js:10-97` |
| `requestCommentary` — direct `.then`（Promise ラップなし） | `ui/network/commentary.js:286` |
| CPU speaker prefix fallback literal | `ui/network/commentary.js:289-291` |
| `parsePortraitCommentaryLog` (log-as-IPC) | `ui/bootstrap.js:237-251` |
| `maybeShowPortraitSpeechFromLog` | `ui/bootstrap.js:253-260` |
| `getSpeakerPrefix` / `getCpuSpeakerPrefix` / `normalizeSpeakerRole` — 既存 | `shared/commentary-runtime-helpers.js:84-97` |
