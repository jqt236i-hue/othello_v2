# 体験を維持する追加軽量化計画

役割: 後続実装のための調査結果・設計判断・実行計画。対象はカードリバーシのCPU解析と盤面表示モデルの内部処理。正本は [ゲーム仕様](../../01-rulebook.md) と [内部契約](../architecture-contracts.md) §4.5、§6.1.1、§7.3、§8、§11。ルール、CPUの強さ、UX、視覚表現を変更する仕様書ではない。

状態: **P1を採用して実装・局所検証まで完了。P2/P3は測定根拠により非採用。P4は安全確認を含む計測へ是正済みだが、標準mobileのP1到達外シナリオで全ターン非悪化をまだ証明できず、heap、Worker mirror、今回分のcommitも保留。**

## 1. 選定方針と完了条件

最優先は、CPUの安全確認で同じ盤面を読むたびに走る内容署名の再計算を減らすこと。`tacticalPositionFeatures` の同期処理内で、既存の `Board.prepareBoardForSearch(Board.createBoardContext(gameState, cardState))` による検索用盤面を一度作り、読み取りに再利用する。共有カーネルの検証・キャッシュ仕様は変えない。

次に同じCPU解析内の重複集計を測定する。盤面表示モデルの署名生成は、CPU改善後も負荷が残る場合の条件付き候補とする。単純なJSONコピー置換、CPU探索の削減、演出の簡略化は採用しない。

| 受入条件 | 内容 | 検証段階 |
| --- | --- | --- |
| A1 ゲーム結果の一致 | 同じ状態・候補順・乱数seedでカード、着手、対象、見送り、理由、探索step数が一致。元状態・本来の乱数状態を変更しない | P0–P2の差分比較とCPUテスト |
| A2 UX・表示の一致 | 操作方法、合法手、表示内容、色・形・画質、演出順序・時間・音、入力ロックと再開条件、キーボード・touch操作を維持 | P3・P4のモデル比較、playback、実ブラウザ |
| A3 性能の改善 | P1の対象局面で呼び出し全体の中央値を10%以上短縮し、署名計算回数も削減。既存場面への有意な遅延・メモリ悪化がない | P0基準とP1/P4候補を同条件で比較 |
| A4 境界の維持 | Single Visual Writer、共有盤面形状、非公開情報、authority、Worker失敗経路、非同期後のstale判定を維持 | 変更対象の既存テストとP4 |
| A5 通常配信 | 最終ソースを通常8000の配信へ反映し、関係する生成物・mirrorを整合させる | P4 |

この計画はFPSや全体負荷の一定割合改善を保証しない。規定の思考待ちが残る局面では、内部処理を短縮してもCPUの着手時刻は同じになり得る。最低思考時間等の設定は維持し、処理の高速化に自然に伴う待ち時間短縮だけを許容する。

完了経路は2つある。変更を採用する場合はA1–A5を満たす。全候補が有効な測定で非採用になった場合は「改善未達・調査完了」とし、A3達成や軽量化完了とは報告しない。後者の配信・コミットの扱いはP4末尾に定める。

対象外: UI/CSS/素材の変更、解像度・FPS・演出量・音質の低下、モデル更新、探索回数・深さ・候補順・打ち切り条件変更、通信形式・永続化の変更、新依存導入、長時間訓練、本番デプロイ、制作素材の整理。

## 2. 調査時点と既存作業

- 調査日: 2026-09-08。HEAD: `553b031195ae729fedec2bd9e5b87c80c08b4587`。
- root、`docs/`、`ui/`、`game/`、`game/ai/`、`shared/`、`scripts/`、`test/` の指示を確認。実装時は追加で触る下位ディレクトリの指示も読む。
- 開始時点にroot `AGENTS.md`、両asset manifest、制作資料の移動・未追跡素材、`worker-public/assets/images/special-stones/crystal_stone.png` の削除等、別作業の変更がある。調査対象コードは開始時のtracked差分に含まれていない。後続は `git status --short` と関係差分を再確認する。
- 過去の完了計画を未完了扱いにして再実装しない。本書は残存候補を扱う追加計画であり、既存の仕様正本を置き換えない。
- 7月の [UX維持最適化記録](../perf/2026-07-24-ux-preserving-runtime-optimization-completion.md) には起動転送量12.73%削減、8月の [ブラウザ性能記録](../perf/2026-08-04-in-game-runtime-browser-performance.md) にはレイアウト計測と入力更新の削減がある。これらは当時の環境・revisionの結果で、現在の基準値ではない。
- [非CPU最適化計画](non-cpu-runtime-performance-remediation-plan.md) は完了済み。[ネット内部最適化計画](../network-internal-optimization-plan-2026-09-05.md) もローカル実装済み。需要時ロード、idle時ticker停止、変更のない描画の省略、通信圧縮・保存最適化を新規施策として数えない。

## 3. 今回確認した根拠

### 3.1 CPUの安全確認が最初の対象

実着手経路は [cpu-turn-move-phase.ts](../../game/cpu-turn-move-phase.ts) のLv6・カードリバーシ条件から `avoidTacticalBlunder` を同期呼び出しする。カード見送りは [cpu-decision-card-choice.ts](../../game/cpu-decision-card-choice.ts) の `shouldHoldTacticallyUnsafeCard`、対象選択は [cpu-decision-pending-onnx.ts](../../game/cpu-decision-pending-onnx.ts) から同じ安全確認に入る。高負荷処理をWorkerへ移す設計変更は今回行わない。

[cpu-tactical-safety.ts](../../game/ai/cpu-tactical-safety.ts) の `tacticalPositionFeatures` は、`BoardContext` を作った後、座標列挙、各セルの存在判定、各セルの所有者取得を繰り返す。[shared-board-utils.ts](../../shared/shared-board-utils.ts) の通常contextに対する各getterは `getContextView` → `createBoardView` を呼ぶ。[state-kernel.ts](../../shared/board/state-kernel.ts) は可変な元状態の変更を検知するため `buildSourceSignature` を計算する。viewがキャッシュ済みでも、この署名作成は必要になる。

同じ同期解析中の不変な入力には、既存の `prepareBoardForSearch` が適合する。検索contextに対するgetterは [search-state.ts](../../shared/board/search-state.ts) に入り、セル取得のたびに可変な元状態の署名を再計算しない。盤面の穴・拡張・負座標を含む投影は既存helperが所有する。

### 3.2 ファイルを変更しない局所試験

Node v24.12.0で現在のTSを `typescript.transpileModule` によりメモリ上でCommonJSとして読み込んだ。rootのJS wrapperは隣接TSへ読み替え、`dist/` を実装の正本として使わなかった。ビルド・サーバー操作・ファイル出力はしていない。

fixtureは [cpu.tactical-safety.test.ts](../../test/cpu.tactical-safety.test.ts) の `setupSafety`、`placementBoard`、`replyTrapBoard`、`cardBoard` を使用。現在実装と、メモリ上だけで `tacticalPositionFeatures` の `b` を検索contextにした実験実装を比較した。

| 観測 | 現在実装 | 実験実装 |
| --- | ---: | ---: |
| placementBoard・白の安全確認の中央値 | 33.6337 ms | 25.1761 ms |
| 同呼び出し全体の `JSON.stringify` 回数 | 12,596 | 9,652 |
| 角を渡す着手の回避・不利な代替の拒否・金の意志の見送り、各黒白の6ケース | 基準 | 戻り値全体が一致 |
| 同6ケースの元状態・乱数を含む入力 | 基準 | JSON比較で変更なし |

中央値の短縮は約25.1%、文字列化回数の削減は約23.4%。時間はウォームアップ3回後の7サンプルずつで、計数用のラップは時間測定と分離した。基準→実験の順番であり、ランダム交互測定・統計的有意性検定はしていない。

別の現在実装の計数試験では、同じ1呼び出しで `JSON.parse` は23回。`JSON.stringify` の呼出元を追跡すると `buildSourceSignature` → `createBoardView` → `getContextView` 系だけで3,318回あり、ほかに `shared/state-hash.ts` の再帰処理等が含まれた。**12,596回すべてが完全な状態コピーという意味ではない。** JSON.parseの計測内時間は約0.6–0.75msで、このfixtureではコピー置換より盤面読み取りの重複削減を優先する根拠になる。

これらは合成済みテスト局面のNode局所試験であり、ブラウザ全体・スマホ実機・対局全体の改善率ではない。6ケースの一致だけで全カード互換を保証しない。P0で再現可能な比較を作り、穴・拡張・保護・上限・失敗条件を追加してから採用する。

### 3.3 その他の候補と判断

| 候補 | 確認した実装 | 判断 |
| --- | --- | --- |
| 安全確認内の追加集計 | `createProbe` の `corners`、`material`、`valuable`。`features` は既にWeakMapで再利用 | P2で計測。既存featuresキャッシュを重複実装しない |
| 表示モデルの署名 | [model.ts](../../ui/board-visual/model.ts) はセルごとに8種の署名を作成。[cell-render-signatures.ts](../../ui/board-visual/cell-render-signatures.ts) でもmarkerを選別。[revision-fingerprint.ts](../../ui/board-visual/revision-fingerprint.ts) は既存署名を利用 | P3は条件付き。marker選別の共通化から始め、表現・署名形式は維持 |
| 状態コピー | [cpu-movement-target-feasibility.ts](../../game/ai/cpu-movement-target-feasibility.ts)、安全確認でJSON round-tripあり | 今回は保留。既存 [state-factory.ts](../../game/logic/cards-internal/state-factory.ts) のコピーは正規化も行い、単純代替ではない |
| MCTSのコピー | [mcts-policy.ts](../../game/ai/mcts-policy.ts) にコピーあり | 通常対局の `searchWithMcts` 呼び出しを今回の検索では確認できず。モジュール登録と実行を混同せず、今回は対象外 |
| 描画待ちの再確認 | [render-scheduler.ts](../../ui/render-scheduler.ts) はdefer中に再scheduleする | `configureRenderScheduler` の通常ソースからの接続を今回確認できず。テスト上のdeferを実負荷と扱わず、今回は変更しない |

## 4. 設計と変更の境界

### 4.1 P1の選定設計

- 所有者は `game/ai/cpu-tactical-safety.ts`。共有helperの公開interface・失敗動作・キャッシュキーは変更しない。
- `tacticalPositionFeatures` の1回の同期実行につき検索contextを一度作る。既存の座標列挙・存在判定・所有者getterに渡す。安定石計算の走査順、保護石判定、危険度、終盤判定、破壊対象取得は維持する。
- 元状態を書き換えない。検索contextをcanonical stateへ保存せず、モジュールglobalへ保持せず、Worker・timer・演出・非同期を越えて持ち越さない。公開関数を同じ可変オブジェクトで再呼び出したときも毎回作り直す。
- 非対応形状・不正入力について現在の結果またはエラー経路を維持する。移行によるnormalizeの差があれば、既存カーネル契約を維持する局所分岐で解決する。解決できなければその候補は採用しない。
- `MAX_SAFETY_STEPS=96`、候補数上限、reply上限、seed、乱数が必要な分岐をunknownとして扱う方針、公開情報だけを使う投影、カードコスト台帳、`steps` の増加位置は変えない。

共有getter自体を無条件にキャッシュする方法は選ばない。元の `gameState` と `cardState` は更新されるため、同一identityだけのキャッシュでは古い盤面が返る。既存の読み取り専用検索投影を局所利用すれば、その危険を増やさずに費用を減らせる。

### 4.2 P2の許容設計

P1後も費用が大きい場合だけ、`createProbe` が所有する1つの解析済み `State` の派生情報を遅延再利用する。候補は角数、石数差、価値集計。共有の盤面helperやカード判定を複製しない。元の式・加算順・候補順を維持する。

`Cards.ensureCardCopyState` とコスト投影の準備完了後、または `applyTurnSafe` / `applyTurnStartPhase` の完了後の状態が対象。変異前後を同じキャッシュidentityとして扱わない。処理中にhelperが入力を変更しないことを確認する。確認できない集計はキャッシュしない。`apply` は複製後に進める既存の方式を保ち、試行回数・副作用を省略しない。

### 4.3 P3の許容設計

対象は1回の `createBoardRenderModel` 内に閉じたmarkerの分類・中間配列作成の重複削減。分類結果を関連署名に共有しても、marker順、kindの正規化条件、`METEOR_HOLE`、`BOARD_FRAME`、seedと石の重なり条件を変えない。各分類の条件が同じとは限らないので単一のkind分類へ安易に統合しない。

8種の署名とrevision fingerprintは旧実装と文字列まで一致させる。短いハッシュへの置換、署名対象項目の削除、可変入力のidentityだけによるフレーム間キャッシュ、freezeや検証の削除は行わない。Pixi backendの変更省略やfingerprintのmodel identityキャッシュは既存実装を維持する。

## 5. 実行フェーズ

### P0 現行差分確認・比較基盤

前提: root指示と本書を読み、調査HEADからの関連変更を確認。製品変更前にbaselineを取得する。

1. 適用指示、関係差分、8000/5174の所有プロセスを確認する。既存正常8000を再利用する。5174で `vite-dist/` を配信している場合はrootの配信制約を解決してからビルドする。別プロジェクトは停止しない。
2. 上述のテストfixtureを基礎に、現行実装の出力と入力非変更を比較可能な形で保存する。後続用に小さな専用計測スクリプトを追加してよいが、その作成は実装段階の作業であり本計画時点には存在しない。古い局所試験値をbaselineに流用しない。
3. Node局所計測は事前に温め、計数と時間を分け、baseline/candidateを交互に測る。専用プロセス、Node版、fixture digest、ソースcommit・差分識別を記録する。fixtureや生成物を変更したら該当baselineを取り直す。
4. 最終ソースからビルドしたVite/Pixiで、既存opponent-action harnessのdesktopとmobile相当条件を測る。既存5シナリオに安全確認fixtureが実際に通る保証はない。Lv6の対象fixtureを通したブラウザ測定を追加し、対象関数の実行を診断で確認する。固定シナリオ契約を壊して既存測定を置き換えない。
5. CPU実行時間と最低思考・Worker・演出待ちを区別する。通常プレイへ常時計測処理やdebug表示を追加しない。診断記録は既存の公開情報保護契約に従う。

完了: A1の旧出力、対象処理の到達証拠、Node/ブラウザの基準値、測定条件が揃う。既存テスト失敗や環境競合は別記する。物理端末がなくてもPC＋mobile emulationで進め、実機性能は未検証と明示する。

### P1 同期CPU解析に検索用盤面を利用

前提: P0完了。§4.1の局所変更のみを先に実施する。

- 既存 [cpu.tactical-safety.test.ts](../../test/cpu.tactical-safety.test.ts)、[shared.board-search-state.test.ts](../../test/shared.board-search-state.test.ts) を使う。
- 追加比較は、通常8×8、穴、非矩形、上下左右の拡張と負座標、保護石、少数石の危険度、黒白、同じ参照の盤面・markerを変更して再呼び出す場合を含める。旧新で `stable/own/danger/late` と安全確認結果が一致すること。
- カード見送り、対象選択、ランダム効果のunknown、上限到達、入力不正、元状態・乱数非変更の既存期待を維持。足りない条件だけ回帰テストを追加する。
- §6の採用判定を行う。満たさなければこの変更だけを戻して結果を記録し、効果なしを成功と報告しない。

完了: A1/A4、CPU局所改善、対象ブラウザ場面の非悪化を確認。共有カーネルそのものへの変更は不要であることを差分で確認する。

### P2 CPU安全確認内の追加再利用（条件付き）

前提: P1の採否が決まり、次の基準profileを取得済み。P1採用時はその実装、不採用時は元の実装を基準にしてP2を独立評価する。

`corners/material/valuable` 等の残存重複が安全確認の同期時間の5%以上、または対象ブラウザ場面で1ms以上を占める場合だけ§4.2を実装する。満たさなければ「計測で優先度不足」と記録して完了扱いにする。

同じプローブ内の1状態・1集計を再利用するところから始める。別の行動シミュレーションや複数の安全確認呼び出しを横断する共有は追加しない。A1を再検証し、呼び出し全体で測定ノイズを越える改善が出なければ採用しない。

完了: 採用箇所・差分比較・実測改善、または非採用の数値根拠が記録されている。

### P3 盤面表示モデルの構築（条件付き）

前提: P0/P1の結果を踏まえ、表示モデルの実行回数と費用が測定されている。

`createBoardRenderModel` と署名・marker処理が対象ターンの同期UI処理の5%以上、または1ms以上を占める場合に限り§4.3を実装する。満たさなければ調査記録だけで終了する。

- [ui.board-visual-model.test.ts](../../test/ui.board-visual-model.test.ts) と [ui.pixi-cell-view.test.ts](../../test/ui.pixi-cell-view.test.ts) を基礎に、8種の署名・fingerprint・materialize後のモデルが旧新一致することを確認する。
- hover、キーボードカーソル、lockだけの変更、石の所有者変更、marker追加・除去、seedと石の共存、穴・拡張を比較する。必要なテストだけ追加する。
- backendの更新回数と表示を測る。署名計算だけが速くても、描画更新・input syncが増える変更は採用しない。

完了: A2/A4と§6を満たすか、負荷不足・効果不足により非採用と判断した根拠が残る。

### P4 統合検証・配信・コミット

前提: 採用するソース変更が確定。P2/P3は条件により非採用でよい。

1. §7の変更に対応する検証を実施。各段階で確認済みの同一内容を理由なく繰り返さない。
2. baselineと最終candidateで対象CPU判断、実着手結果、演出、入力、RAF/Long Task、heap推移を比較する。UI変更がなくても通常対局の実着手は確認する。
3. 影響する生成物を既存スクリプトで生成し、root/mirrorを確認。別作業のasset manifest・素材変更が生成へ混ざる場合は差分を切り分ける。切り分けできない上書きが必要なら具体的な衝突を示してその部分だけ確認する。
4. 最終ソースで `npm run build:vite` を実行し、8000のHTTP 200、当該repoの所有プロセス、独立して存続する起動根拠を確認。HTTP成功とプレイ成功は別々に記録する。継続起動できない場合は未完了として明示する。
5. `git diff --check` と完了前の `git status --short` を確認。今回のソース・テスト・必要生成物・記録だけをコミットする。既存素材を削除・移動しない。本番デプロイは実施しない。

完了: A1–A5を満たし、変更点、実測値、実ブラウザURL/Vite・classic/Pixi・DOM、操作結果、commit、未検証範囲、別作業の残りを簡潔に報告。

全候補非採用の場合は、試験用の製品変更を今回分だけ元に戻したことと全候補の数値根拠を確認し、「改善未達・調査完了」と報告する。製品変更を配信済みなら元の最終ソースから再ビルドして配信も戻す。製品変更を配信しておらず生成物も元の状態なら、新たな製品ビルド・mirror更新は不要。P0等でサーバーを起動・引き継いだ場合はrootルールに従い最後の8000確認を行う。残す計測スクリプト・テスト・調査記録のみを検証してコミットし、A3未達を明示する。

## 6. 測定と採用の判断規則

これらは今回の作業用の判定基準であり、ゲーム仕様や恒久的性能SLAではない。

- **P1の改善**: P0の対象fixtureと同じ条件で安全確認全体の中央値10%以上短縮、署名作成回数減少、A1完全一致を要求する。局所だけでなくブラウザの対象経路でも改善または非悪化を確認する。
- **P2/P3の改善**: 各段階の直前を基準に対象処理の中央値10%以上短縮し、対象の全ターン同期時間で逆効果がないこと。入り口の5%/1ms条件は着手の判定であり、採用の証拠ではない。
- **悪化の検出**: 同条件の既存場面で同期処理p95が基準より `max(2ms, 基準値の5%)` を超えて遅くなる場合は再調査。RAF p95が1描画周期以上悪化、新たなアプリ起因50ms以上stall、入力が余分に1フレーム以上待つことが再現する場合も採用しない。
- **メモリ**: 同じ操作列・warmup後のheapを同じ回収条件で比較し、操作回数に伴う継続増加がないこと。retained heapが `max(1MiB, 基準の5%)` を超えて再現性を持って増える場合は調査・解消する。未測定ならメモリ削減を主張しない。JSON文字数をheap byteや通信量に換算しない。
- **表示**: 同一browser/GPU/viewport/DPR/seed/演出時点の画像とモデルを比較する。許容差は既存視覚検証に従い、新しい差を通すために閾値やbaseline画像を書き換えない。NOANIMだけでは通常の演出時間・音の一致を証明しない。
- **環境差と成果物識別**: browser/GPU、hardware acceleration、viewport/DPR、CPU throttle、warm/cold cache、ビルド設定を一致させる。baseline/candidateの成果物hashは各々記録する。ソース最適化後は異なるhashになり、同一候補に対する各検証ではその候補hashと一致することを確認する。別訓練・別検査と性能測定を同時に走らせない。干渉があればその測定を無効として同条件で取り直し、改善率に混ぜない。
- **効果不足**: 有効な測定で改善しなければ候補を採用せず次の独立候補へ進む。条件を満たさない全候補が非採用でも、根拠を報告して探索を終了できる。数値目標のためにUXやCPUを変えない。

## 7. 検証コマンドと前提

以下は実装段階用。今回の計画作成では実行していない。定義は [package.json](../../package.json) と各スクリプトのソースで確認済み。`npm test` はpretestで全checkを伴うため、初期検証には限定Jestを使う。

CPUの最小セット:

```powershell
npm run test:jest -- --runTestsByPath test/cpu.tactical-safety.test.ts test/shared.board-search-state.test.ts test/cpu.decision.pending-onnx.test.ts test/cpu-turn-move-phase.worker-scoring.test.ts
npm run typecheck
```

表示モデルに変更を採用した場合:

`test:visual` はbaseline画像がないと新規作成するため、P0で既存baselineの有無と対象revisionを確認する。新規作成の成功を変更前後の一致と扱わず、必要なら変更前の決定的画像を保存してから比較する。`VISUAL_UPDATE_BASELINE` は有効にしない。

```powershell
npm run test:jest -- --runTestsByPath test/ui.board-visual-model.test.ts test/ui.pixi-cell-view.test.ts
npm run match:pixijs-board-playback-check
npm run match:pixi-runtime-fallback-check
npm run match:cross-platform-smoke:vite
npm run test:visual
```

時間制御を触ることが必要になった場合は設計範囲を再確認し、適用指示に従う `npm run test:jest:noanim` と通常アニメーション検証を併用する。network/authorityや共有状態の意味を変える修正が生じた場合は範囲を見直し、`npm run test:network:parity` / `npm run test:match:parity` の該当側を実行する。P1の局所読み取りだけでauthority実装まで変更しない。

ブラウザ測定の既存入口（先に `npm run build:vite`。同コマンドは `build:browser` と `build:ts` を含む）:

```powershell
node dist/scripts/perf/measure-opponent-action-frame-stall.js --quick --profile lightweight-desktop --output artifacts/opponent-action-frame-stall/lightweight-baseline-desktop.json
node dist/scripts/perf/measure-opponent-action-frame-stall.js --quick --profile lightweight-mobile --mobile --cpu-throttle 4 --output artifacts/opponent-action-frame-stall/lightweight-baseline-mobile.json
```

candidateは出力名の `baseline` を `candidate` に変え、対応する `--profile` は同じままで同条件取得する。quickはwarmup1回・各5サンプルの切り分け用。採用判断は必要に応じ `--quick` を外した既存標準測定（warmup5回・各20サンプル）を使い、比較する両側でサンプル数を揃える。`--cpu-profile <path>` は呼出元分析用で、profile取得あり/なしの時間を混ぜない。P0の安全確認専用fixture測定は別途必要。harnessは一時HTTPサーバーを所有するため、終了時の解放も確認する。

上記CLIはcaptureを行う入口であり、本書§6の合否判定を自動実行するコマンドではない。実装担当は出力から§6を比較し、再利用可能な専用比較処理を追加してよい。同ファイルの `evaluateBlockingPerformanceGate` には別作業由来のLv1・70%短縮目標等があるため、今回の採用基準へ流用しない。既存gate・既存テストは変更しない。共通の比較前提である同一profile/fixture/サンプル数/環境と、異なる最適化前後の成果物hashは守る。

生成・配信:

```powershell
npm run worker:prepare
npm run check:worker-mirror
npm run build:vite
git diff --check
git status --short
```

mirrorの2コマンドもブラウザビルドを行う。実際に同じ最終ソースのビルドを含む検証が済んでいれば、重複実行を省き、その結果を最終buildの証拠として記録してよい。サーバー所有・継続性・HTTP確認はrootのLOCAL DEV SERVERに従って別に行う。

## 8. 裁量、設計へ戻す条件、進捗記録

ローカル命名、既存パターンに沿う関数分割、fixture追加、受入条件を満たす局所修正は実装担当の裁量。今回の範囲内で根拠のある計画誤りは修正して続行できる。公開契約、新依存、盤面の投影・検証方式、非同期境界、CPU判断、表示やタイミングの意味を変える案は、そのまま実装せず設計を見直す。ユーザー確認は製品上の選択や大きな範囲拡張が必要な場合に限る。

同じ失敗に対する修正で新しい証拠が得られなくなったら、差分、期待/実際、試した修正、必要な判断を本書へ記録し、該当段階とその依存だけを保留する。独立作業は続ける。失敗を通すために受入条件やテストを弱めない。

| 段階 | 状態 | 実測・確認・残件 |
| --- | --- | --- |
| 計画時調査 | 完了 | 静的調査、メモリ上の局所試験。製品コード変更なし |
| P0 | 完了 | Node/Vite-Pixi/desktop/mobile emulationの基準と対象経路を記録。詳細は§9 |
| P1 | 採用・完了 | 同期安全確認内だけで検索用盤面を再利用。A1/A3/A4の局所・対象ブラウザ証拠あり |
| P2 | 非採用 | `corners/material/valuable` の計測上限は同期安全確認の4.18%で、5%条件を満たさない |
| P3 | 非採用 | 実ターンの1呼び出しp95は0.4–0.8ms。候補のbrowser側改善が10%に届かず、差分は撤回 |
| P4 | 保留 | 安全確認を含むv3計測へ是正。Lv6は改善したが、標準mobileのLv1 multi-target p95悪化は未解決。heap、Worker mirror、commitも未完了 |

計画レビュー記録: 計画作成時に自己点検とGPT-6 Astra（low）の読み取り専用独立レビュー1回を実施。成果物hashとcapture profileの比較条件、および全候補非採用時の完了経路の矛盾を修正した。P1不採用時のP2基準も明示した。実装後の測定・検証と保留理由は§9に記録する。

## 9. 実施記録（2026-09-08）

### P0: 現行確認と基準測定

- 指定された `C:\Users\quarr\Desktop\othello\_v2` は存在せず、このworkspaceの `C:\Users\quarr\Desktop\othello_v2` に対象資料があったため、後者で実施した。開始時点の関連コードは調査HEAD以降に変更がなく、asset/manifest/`worker-public` の既存差分は保護対象とした。
- 再利用可能な計測器 `scripts/perf/measure-cpu-tactical-safety.ts` を追加した。時間と計数を分離し、Nodeではbaseline/candidateを交互に15回（warmup 3回）実行し、入力・乱数・出力digestを比較する。ブラウザではVite/Pixiで公開関数へ到達する。
- レビューで判明した名前だけのfixture digestは廃止し、計測器をschema v2へ更新した。digestは各caseの実行種別、盤面・card state・選択手・候補列・player・level・PRNG seed/stateをcanonical JSONで識別する。盤面、seed、候補が変わるとdigestが変わる回帰試験を追加した。旧v1 artifactは履歴として残すが、同条件比較の証拠に使わない。
- Node基準はfixture digest `f747e2e3…`、Vite/Pixi基準は `34725a7b…` で取り直した。Nodeの旧新比較とVite/Pixi基準は§9 P1の表・数値を正本とする。Vite/Pixi基準はRTX 2070/D3D11、white 38.7ms（p95 46.3）、black 38.8ms（p95 47.0）、各 `JSON.stringify` 12,596回、9 captureだった（`artifacts/cpu-tactical-safety/p0-baseline-browser-v2.json`）。
- 既存5シナリオの旧quick recordは安全確認を同期区間へ含めていなかったため、全ターン判定には使わない。v3でdesktop/mobile emulationを取り直し、標準mobile（warmup 5・20 capture）の結果はP4に記録する。物理モバイル端末は未計測である。

### P1: 同期安全確認の検索用盤面

- `game/ai/cpu-tactical-safety.ts` の `tacticalPositionFeatures` で、既存の `createBoardContext` 直後に `prepareBoardForSearch` を一度だけ適用した。共有kernel、公開契約、候補順、step上限、乱数、待機・演出経路は変更していない。
- `test/cpu.tactical-safety.test.ts` に、穴、負座標を伴う拡張、circle形状、保護石、同一参照の盤面/marker変更後の再実行を追加した。既存のカード見送り、pending対象、unknown、上限、黒白の回帰試験と合わせて49テストが通過した。

| Node fixture | baseline → candidate 中央値 | `buildSourceSignature` |
| --- | ---: | ---: |
| placement corner / white | 41.951 → 28.666ms | 3,820 → 876 |
| placement corner / black | 42.918 → 30.339ms | 3,820 → 876 |
| gold hold / white | 9.619 → 6.345ms | 861 → 93 |
| gold hold / black | 10.017 → 5.581ms | 861 → 93 |
| reply trap / white | 16.025 → 10.439ms | 1,671 → 263 |
| reply trap / black | 15.875 → 10.402ms | 1,671 → 263 |

- v2の最終Node比較では全6ケースの結果digest、入力、乱数が一致し、中央値は29.309–44.285%短縮、署名構築は768–2,944回減少した（`artifacts/cpu-tactical-safety/p1-final-node-v2.json`、source hash `501a442f…`）。
- v2のVite/Pixi対象fixture（RTX 2070）はwhite 38.7→28.6ms（p95 46.3→47.1）、black 38.8→28.8ms（p95 47.0→37.1）、各 `JSON.stringify` 12,596→9,652回で、出力digestと入力不変が一致した。whiteのp95差は0.8msで `max(2ms, 5%)` 未満である（`artifacts/cpu-tactical-safety/{p0-baseline,p1-final}-browser-v2.json`）。このbrowser値はNodeの局所改善率を全対局の改善率として扱わない。

### P2/P3: 条件付き候補の判断

- P2ではP1候補の90安全確認を計測し、`corners`/material/valuableに属する外部呼び出しの合計上限は 55.094ms / 1,318.824ms = **4.18%** だった。個々の処理は重なり得るため上限として扱い、5%条件未満のため実装しなかった。browser側の成分時間を推定値で1ms以上と扱わず、独立した到達証拠がない限り採用しない。
- P3では実ゲームのVite/Pixiで `createBoardRenderModel` の通常呼び出しp95が0.4–0.8msだった。markerを一走査にまとめる実験はNodeのmarker-heavy fixtureで0.556864→0.474899ms（fingerprint SHA-256一致）だったが、Vite/Pixiでは約0.40→0.3807msでP3の10%基準に届かなかった。実験差分と追加試験は撤回し、表示・署名形式を変更していない。

### P4: 統合、通常配信、残件

- 最終候補で `npm run build:vite`、`npm run typecheck`、関連7 suite / 61 tests、`git diff --check` を実行した。すべて成功し、buildは既存のchunk size警告のみだった。8000はrepo直下を配信するPID 39800のNode `http-server` が継続所有し、HTTP 200（38,829 bytes）を確認した。
- レビュー是正: 旧recordの `syncInvocationMs` は `avoidTacticalBlunder` を計測区間外で実行していたため、旧v2の全ターン値（mobile 44.5msを含む）をP4の判定に使わない。Lv6の安全確認を `tactical-safety` 同期stageへ含め、browser sample schemaをv2、report schemaをv3へ上げた。Lv6 worker-backed fixtureでこのstageが欠けるrecordは検証エラーになるため、安全確認を含まない同期合計を再び有効な全ターン記録として扱えない。
- 同一profile `lw-standard-m3`、同一fixture digest `f2d4a4e2…`、mobile emulation（390×844/DPR 2、CPU throttle 4）、warmup 5回・各20 captureでbaseline/candidateを標準再測定した。成果物hashは最適化前後で異なるが、全5シナリオで20/20 valid、操作順・カード効果・Worker経路・Pixi playback・outcome digestが一致した。P1到達Lv6では、同期処理の中央値/p95が 222.0/343.4→190.5/249.9ms、安全確認stageが 177.4/270.3→141.1/202.0ms、アプリ帰属Long Task p95が296.1→180.1msとなった。安全確認そのものの改善は確認できた（`artifacts/opponent-action-frame-stall/lightweight-standard-{baseline,candidate}-mobile-v3.json`）。
- ただし同じ標準mobileのP1が到達しないLv1 multi-targetでは、同期p95が97.4→245.0ms、maxが252.1→450.9msとなった。そこには `tactical-safety` stageがbaseline/candidateとも存在せず、candidate側の大きい区間は `canonical-commit`、`commentary-context`、`presentation-handoff` と未帰属Long Taskに出ている。P1起因とは断定しないが、全ターンの非悪化を証明できないため、quick recordは診断専用とし、P4は通過・配信可とは扱わない。原因分離または清浄な同条件pairによる再測定が必要である。
- heapは同じ操作列・同じ回収条件で取得していない。メモリ非悪化・メモリ削減はいずれも**未確認**であり、JSON文字数の減少をheapの証拠にしていない。
- 通常サーバーは `http://127.0.0.1:8000/` でrepo直下を配信するNode `http-server` として継続起動し、HTTP 200を確認した。`?boardRenderer=pixi&debug=1`（Vite/Pixi、canvas 1枚）で通常の合法手を実クリックし、黒2/白2→黒4/白1の着手・反転演出、CPU応答後のROUND 2・黒3/白3・自分のターンへの復帰を確認した。console errorは0件だった。
- DOM compatibility（`?boardRenderer=dom&debug=1`）は `DOM compatibility stone visuals failed to prepare (1 failed assets)` でboot errorになった。これはP1の変更範囲外で、開始時からあるasset作業と同じ未解決状態として記録する。Pixiの通常経路は成功した。
- `npm run worker:prepare` は、開始時から削除状態の `worker-public/assets/images/special-stones/crystal_stone.png` をasset case検査が検出して停止した。続く `npm run check:worker-mirror` もasset manifestと未追跡素材を含む47件の既存mirror差分で失敗した。これらを復元・削除・上書きすると別作業の素材を壊すため実施していない。よってWorker mirror更新、mirror合格、今回分だけのcommit、本番デプロイは**未完了**である。

残件: (1) P1到達外の標準mobile multi-target p95悪化を原因分離し、同じ条件の清浄なbaseline/candidate pairで全ターン非悪化を確認する、(2) 同じ操作列・warmup・回収条件でheap推移を比較する、(3) asset作業の所有者が上記削除・manifest・未追跡素材を整理または引き継いだ後に、`npm run worker:prepare`、`npm run check:worker-mirror`、最終`npm run build:vite`を再実行し、今回のソース・テスト・生成物・本記録だけをcommitする。物理モバイル端末とDOM compatibilityの成功も未検証である。
