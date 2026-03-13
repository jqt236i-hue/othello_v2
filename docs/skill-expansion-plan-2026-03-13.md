# Skill Expansion Plan 2026-03-13

作成日: 2026-03-13  
対象: `.github/skills/` 拡張計画  
状態: 調査完了 / 実装前

## 0. この文書の位置づけ

- この文書は、次に追加する 5 本の workflow skill を安全に作るための事前調査と実装計画です。
- 仕様やゲーム挙動の一次情報は引き続き `01-rulebook.md` です。
- ここで扱うのは agent customization の設計であり、ゲーム仕様変更そのものではありません。
- 実装対象は次の 5 本です。
  - `network-playback-workflow`
  - `cpu-onnx-gate-workflow`
  - `deck-builder-authoring-workflow`
  - `card-effect-integration-workflow`
  - `worker-public-sync-workflow`

## 1. 結論

- 5 本とも作る価値があります。
- ただし一気に書くより、共通テンプレートを先に固定し、依存の強い順に段階導入した方が保守しやすいです。
- 実装順は、調査前に出していた優先順位を維持します。
  1. `network-playback-workflow`
  2. `cpu-onnx-gate-workflow`
  3. `deck-builder-authoring-workflow`
  4. `card-effect-integration-workflow`
  5. `worker-public-sync-workflow`
- ただし `worker-public-sync-workflow` は 5 番目に作る一方で、他 4 本の中に共通ガードとして先に反映しておく前提で進めます。

## 2. 今回の自前調査で分かった共通パターン

### 2.1 skill に向いている条件

- 毎回読む順がほぼ同じ
- root cause が毎回似ている
- root と `worker-public/` のような二重配置や、`game/` と `ui/` のような境界確認が必要
- 関連テストの束がほぼ固定されている
- repo memory に同系統の罠メモが複数蓄積している

### 2.2 5 本に共通する設計ルール

- 強制ルールは再定義しない
- `AGENTS.md` / `.github/copilot-instructions.md` / `.github/instructions/*.instructions.md` の補助だけを行う
- skill は「どこから読み、どこで止め、何を回すか」を固定する
- 各 skill は次の見出しを基本形にする
  - `When to Use`
  - `Default Stance`
  - `Repo-specific Facts`
  - `Procedure`
  - `Branching Guide`
  - `Guardrails`
  - `Stop And Clarify Only If`
  - `Good Prompts`

### 2.3 cross-cutting で毎回書くべき注意

- root 側と `worker-public/` 側のどちらを正本にするか先に決める
- playback / presentation / pending target は単一書き手を壊さない
- `cpu/` や `game/` を UI 都合で直接触らせない
- 変更後は、対象に合った最小のテスト束を skill に明記する

## 3. 調査結果サマリ

| skill | 追加先 | 主対象 | 主な正本 | 代表的な罠 | 最小確認 |
| --- | --- | --- | --- | --- | --- |
| `network-playback-workflow` | `.github/skills/network-playback-workflow/SKILL.md` | network snapshot / reconnect / playback queue | `ui/network-client.js`, `ui/network/snapshot.js` | `force: true` snapshot が local presentation queue を落とす | `test/ui.network-client.result-sync.test.js`, `test/ui.network-client.action-bridge-next-snapshot.test.js`, `test/ui.network-client.trap-deferred-publish.test.js` |
| `cpu-onnx-gate-workflow` | `.github/skills/cpu-onnx-gate-workflow/SKILL.md` | browser ONNX gate / benchmark / degrade | `scripts/benchmark-policy-onnx-gate.js`, `ui/handlers/cpu-policy.js`, `game/ai/policy-onnx-runtime.js` | profile parity で ONNX 自体が読み込まれず gate が待ち続ける | `test/selfplay.policy-onnx-gate.test.js`, `test/game.cpu-policy-onnx-runtime.test.js` |
| `deck-builder-authoring-workflow` | `.github/skills/deck-builder-authoring-workflow/SKILL.md` | deck builder / story-deck-lab authoring | `shared/deck-spec.js`, `ui/deck-builder-*.js`, `ui/story-deck-lab/*` | rerender 後の scroll anchor drift | `test/ui.deck-builder-controller.test.js`, `test/shared.deck-codec.test.js`, `test/story-deck-lab.page.test.js` |
| `card-effect-integration-workflow` | `.github/skills/card-effect-integration-workflow/SKILL.md` | card effect の end-to-end 追加/変更 | `cards/catalog.json`, `cards/catalog.generated.js`, `game/logic/cards.js`, `game/card-effects/*` | pending target / CPU / presentation のどれかを取りこぼす | `test/cards.generate.test.js`, `test/cards.catalog.test.js`, `test/game.pending-target-selector.test.js`, `npm run test:jest:changed` |
| `worker-public-sync-workflow` | `.github/skills/worker-public-sync-workflow/SKILL.md` | root → worker-public 同期 / deploy | `scripts/prepare-worker-assets.js`, `wrangler.toml`, `workers/match-worker.mjs` | `worker-public/` 直編集、prepare 忘れ、size limit 超過 | `npm run worker:prepare`, `test/index.card-module-scripts.test.js` |

## 4. 各 skill の調査要点

### 4.1 network-playback-workflow

#### 4.1.1 目的

- network mode の snapshot apply、heartbeat/reconnect、presentation queue 保持、busy lock の崩れを安全に直す

#### 4.1.2 正本として扱うファイル

- `ui/network-client.js`
- `ui/network/snapshot.js`
- `ui/network/session-seat.js`
- `workers/match-worker.mjs`
- mirror 確認用として `worker-public/ui/network/*`

#### 4.1.3 skill に固定すべき読む順

1. repo memory の network 系メモを確認
2. `ui/network-client.js` の publish / reconnect / heartbeat 経路を確認
3. `ui/network/snapshot.js` の `applySnapshot()` を確認
4. `workers/match-worker.mjs` の public snapshot projection を確認
5. action bridge / deferred publish の有無を `ui.network-client.*` 系 test 名から確認
6. network 系テストで結果 sync / reconnect / stale response を確認

#### 4.1.4 固定で入れるべき罠

- incoming `playbackEvents` が無い `force` snapshot で local queue を消さない
- legacy marker 復元を snapshot apply 直後に入れる
- stale publish response で新しい local state を巻き戻さない
- deferred publish を使うカード action は action bridge 側の auto publish を止める

#### 4.1.5 固定の確認コマンド

- `npx jest test/ui.network-client.result-sync.test.js --runInBand`
- `npx jest test/ui.network-client.action-bridge-next-snapshot.test.js --runInBand`
- `npx jest test/ui.network-client.trap-deferred-publish.test.js --runInBand`
- `npx jest test/ui.network-client.publish-base-version.test.js --runInBand`
- `npx jest test/ui.network-client.reconnect-sync.test.js --runInBand`

### 4.2 cpu-onnx-gate-workflow

#### 4.2.1 目的

- browser ONNX gate が落ちる、待ち続ける、latency guard が強すぎる、candidate artifact 差し替えが危ない、という問題を切り分ける

#### 4.2.2 正本として扱うファイル

- `scripts/benchmark-policy-onnx-gate.js`
- `scripts/run-ui-level-match.js`
- `ui/handlers/cpu-policy.js`
- `game/ai/policy-onnx-runtime.js`
- `game/cpu-decision.js`
- `constants/cpu-lv6-shared-profile.js`

#### 4.2.3 skill に固定すべき読む順

1. shared profile と `cpu-policy.js` で browser 側有効条件を確認
2. `benchmark-policy-onnx-gate.js` の args / seed / decision を確認
3. `run-ui-level-match.js` の browser 起動条件を確認
4. runtime status と latency summary の取り方を確認
5. `game/cpu-decision.js` の degrade guard と hold 判定を確認
6. gate decision と test を確認

#### 4.2.4 固定で入れるべき罠

- profile parity だけで browser ONNX が無効になり gate が永久待機する
- `?cpuOnnx=1` と `?cardSpecialist=1` の inject 条件を忘れる
- float ループ回数で seed / games の試行数がズレる
- latency threshold が hardware に対して非現実的で false negative になる
- candidate と target artifact の同一路径差し替えで restore が壊れる

#### 4.2.5 固定の確認コマンド

- `npx jest test/selfplay.policy-onnx-gate.test.js --runInBand`
- `npx jest test/game.cpu-policy-onnx-runtime.test.js --runInBand`
- `npx jest test/cpu.turn-handler.onnx-hold.test.js --runInBand`
- `npm run selfplay:onnx-gate -- --candidate-onnx ...`

### 4.3 deck-builder-authoring-workflow

#### 4.3.1 目的

- deck builder と story-deck-lab の authoring UI を、state / renderer / controller / handler の責務を崩さず直す

#### 4.3.2 正本として扱うファイル

- `shared/deck-spec.js`, `shared/deck-codec.js`
- `ui/deck-builder-state.js`
- `ui/deck-builder-renderer.js`
- `ui/deck-builder-controller.js`
- `ui/handlers/deck-builder.js`
- `shared/story-deck-spec.js`, `shared/story-deck-codec.js`
- `ui/story-deck-lab/*`

#### 4.3.3 skill に固定すべき読む順

1. spec / codec で形式制約を見る
2. state で draft 正規化と count 制約を見る
3. renderer で scroll anchor と DOM 構造を見る
4. controller で rerender と notice を見る
5. handler と page test で wiring を見る
6. shared deck に触る場合は network room deck test まで見る

#### 4.3.4 固定で入れるべき罠

- clicked card の位置を基準にした scroll anchor 保持を忘れて viewport がズレる
- preset 切り替えや rerender で body scroll だけ見て drift する
- root 側だけ直して `worker-public/` mirror を同期しない
- draft normalize が silent に情報を落として downstream を壊す

#### 4.3.5 固定の確認コマンド

- `npx jest test/ui.deck-builder-controller.test.js --runInBand`
- `npx jest test/shared.deck-codec.test.js --runInBand`
- `npx jest test/ui.story-deck-lab-state.test.js test/ui.story-deck-lab-renderer.test.js test/story-deck-lab.page.test.js --runInBand`
- shared deck まで触った場合は `npx jest test/workers.match-room-deck.test.js --runInBand`

### 4.4 card-effect-integration-workflow

#### 4.4.1 目的

- 新カード追加や既存カード改修を、catalog / logic / pending target / CPU / playback / logs まで漏れなく通す

#### 4.4.2 正本として扱うファイル

- `cards/catalog.json`
- `cards/catalog.generated.js`
- `cards/catalog.js`
- `shared-constants.js`
- `game/logic/cards.js`
- `game/card-effects/*.js`
- `game/turn-handlers/pending-target-selector.js`
- `game/turn/pipeline_ui_adapter.js`
- `game/cpu-decision.js`
- `game/ai/cpu-policy-core.js`
- `cards/card-interaction.js`
- `ui/playback-engine.js`
- `ui/presentation-handler.js`

#### 4.4.3 skill に固定すべき読む順

1. `01-rulebook.md` と catalog を確認
2. `cards/catalog.json` / `cards/catalog.generated.js` / `cards/catalog.js` の生成関係を確認
3. `game/logic/cards.js` の apply/use/pending state を確認
4. effect module を確認
5. `game/turn-handlers/pending-target-selector.js` と `game/turn/pipeline_ui_adapter.js` を確認
6. pending target selector と CPU 側 wrapper を確認
7. `ui/presentation-handler.js` / `ui/playback-engine.js` / log を確認
8. `worker-public/` mirror の要否を確認

#### 4.4.4 固定で入れるべき罠

- `catalog.json` と `catalog.js` を同期し忘れる
- `cards/catalog.generated.js` を更新せず生成経路と表示経路がズレる
- `pending-target-selector.js` と CPU wrapper の戻り shape がズレる
- `destroyAt()` より前に marker を消して特殊フラグを失う
- presentation event を emit し忘れて logic だけ成功する
- `worker-public/game/*` が古いままで CPU だけ別挙動になる

#### 4.4.5 固定の確認コマンド

- `npm run generate:catalog`
- `npx jest test/cards.generate.test.js test/cards.catalog.test.js --runInBand`
- `npx jest test/game.pending-target-selector.test.js --runInBand`
- 対象カードの unit test
- `npm run test:jest:changed`
- 必要時 `npm run worker:prepare`

### 4.5 worker-public-sync-workflow

#### 4.5.1 目的

- root を正本にしたまま `worker-public/` mirror、asset 制限、prepare / deploy を安全に扱う

#### 4.5.2 正本として扱うファイル

- `scripts/prepare-worker-assets.js`
- `wrangler.toml`
- `workers/match-worker.mjs`
- `docs/network-worker-deploy.md`
- root 側の `game/`, `ui/`, `shared/`, `constants/`, `cards/`, `utils/`, `assets/`

#### 4.5.3 skill に固定すべき読む順

1. `wrangler.toml` で assets dir と worker entry を確認
2. `package.json` の `worker:*` scripts を確認
3. `scripts/prepare-worker-assets.js` で DIRS / ROOT_FILES / OPTIONAL_FILES を確認
4. `docs/network-worker-deploy.md` の deploy 手順と注意点を確認
5. 関連 test の対象を確認
6. prepare → verify → deploy の順を固定する

#### 4.5.4 固定で入れるべき罠

- `worker-public/` を直接編集して次回 prepare で消す
- root 側を直したのに `npm run worker:prepare` を忘れる
- optional assets が 25 MiB 制限を超える
- script path / script order が root と worker-public でズレる
- story/tutorial の二重配置で primary source を曖昧にしたまま進める

#### 4.5.5 固定の確認コマンド

- `npm run worker:prepare`
- `npx jest test/index.card-module-scripts.test.js test/index.local-script-paths.test.js --runInBand`
- `npx jest test/workers.match-stream-sse.test.js --runInBand`

## 5. 実装順とフェーズ計画

### Phase 1: 共通テンプレートを固定する

#### Phase 1 の目的

- 5 本すべてが同じ読み味になるよう、見出しと粒度を先に揃える
- 各 skill の frontmatter と見出し順を初手で固定し、後工程での drift を防ぐ
- `worker-public-sync-workflow` から root 正本 / `worker-public/` 直編集禁止 / `worker:prepare` 必須の共通ガードだけ先に抽出する

#### Phase 1 の作業

- 既存の `safe-rational-refactor` と `story-tutorial-workflow` の構成を共通テンプレートとして再利用する
- 各 skill は 120〜220 行程度を目安にする
- それぞれに `Good Prompts` を 3〜5 本入れる
- frontmatter の必須項目を `name` / `description` / `argument-hint` に固定する
- markdown error だけでなく frontmatter 構文と見出し順も確認項目にする

#### Phase 1 の完了条件

- skeleton だけの draft を 5 本分の見出しで作れる状態になっている
- 5 本とも同じ frontmatter 形式と見出し順で開始できる

### Phase 2: 依存の強い skill から実装する

#### Phase 2 の順番

1. `network-playback-workflow`
2. `cpu-onnx-gate-workflow`

#### Phase 2 の理由

- どちらも読み順と validation の束が固く、repo memory の密度も高い
- 他 skill から参照しやすい cross-cutting guard を先に固められる

#### Phase 2 の完了条件

- 2 本とも、固有の罠と最小テスト束が書かれている
- `SKILLS.md` に短い索引が追加されている

### Phase 3: authoring 系を実装する

#### Phase 3 の順番

1. `deck-builder-authoring-workflow`

#### Phase 3 の理由

- 既に plan doc があり、MVC 分割もはっきりしている
- `story-tutorial-workflow` と並んで UI authoring 系の代表 skill になる

#### Phase 3 の完了条件

- scroll anchor 保持と root / worker-public 同期注意が skill 内に含まれている

### Phase 4: 広域 integration skill を実装する

#### Phase 4 の順番

1. `card-effect-integration-workflow`

#### Phase 4 の理由

- 対象範囲が最も広く、前の 3 本より記述量が増える
- 他 skill と重なる guard が多いので後ろに回した方が重複を減らせる

#### Phase 4 の完了条件

- catalog → logic → pending target → CPU → UI → worker-public sync の流れが 1 本に落ちている

### Phase 5: sync 専用 skill を実装する

#### Phase 5 の順番

1. `worker-public-sync-workflow`

#### Phase 5 の理由

- 内容は横断的だが、他 4 本の中に先行して注意として埋め込める
- 最後に単独 skill として切り出した方が、他 skill との責務境界を整理しやすい

#### Phase 5 の完了条件

- root 正本ルール、prepare / verify / deploy 手順、asset size 制限、二重配置判断が独立 skill として読める

## 6. 5 本を作る時の done 条件

- `.github/skills/<name>/SKILL.md` が 5 本作成されている
- `SKILLS.md` から 5 本に辿れる
- 各 skill に次が入っている
  - 対象領域の正本ファイル
  - 固定の読む順
  - 代表的な罠
  - 最小の validation コマンド
  - 実用的な prompt 例
- 5 本とも frontmatter に `name` / `description` / `argument-hint` を持つ
- 5 本とも見出し順が共通テンプレートに揃っている
- markdown error が出ていない
- `01-rulebook.md` は未更新でよいが、最終報告で「不要理由」を明記する

## 7. 実装時のリスクと対策

### リスク 1: skill 間の重複が増える

#### リスク 1 の対策

- cross-cutting の注意は 2〜4 行に留める
- 詳細はその skill の固有領域だけに書く

### リスク 2: worker-public 判断が skill ごとにズレる

#### リスク 2 の対策

- すべての skill に「先に primary source を決める」を入れる
- Phase 1 で `worker-public-sync-workflow` の共通ガードだけ先に抽出する
- `worker-public-sync-workflow` ができたら参照先を統一する

### リスク 3: test コマンドが長すぎて使われない

#### リスク 3 の対策

- 各 skill に Tier 1 の最小コマンドだけを必須として置く
- より重い test 束は補助として書く

### リスク 4: plan を書いたまま実装粒度が揺れる

#### リスク 4 の対策

- 1 本作るたびに `SKILLS.md` の索引を最小更新する
- 既存 2 本と同じ frontmatter / 見出し構成を維持する

## 8. 次に実施する具体作業

1. `network-playback-workflow` の SKILL.md を作る
2. `cpu-onnx-gate-workflow` を続けて作る
3. そこで一度 `SKILLS.md` を更新し、粒度が適正か確認する
4. `deck-builder-authoring-workflow` を作る
5. `card-effect-integration-workflow` と `worker-public-sync-workflow` を最後に追加する

## 9. 今回の計画書作成時点で 01-rulebook.md を更新しない理由

- 今回はゲーム仕様変更ではなく、agent customization の計画整理だけを行った
- 追加予定の skill も workflow 文書であり、ゲーム挙動そのものを変更しない
