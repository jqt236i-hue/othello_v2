# ネット対戦・通常配置の待ち時間短縮 実装計画

## 目的と正本

`docs/implementation/network-placement-latency-reduction-design.md` に従い、通常配置のローカル仮表示と、保存後 SSE fanout の非待機化を実装する。プレイヤー向け仕様は `01-rulebook.md` と `正本/演出正本.md`、内部契約は `docs/architecture-contracts.md` を正本とする。

## 非目標

- canonical state の先行更新
- server 検証、永続保存、replay artifact の省略
- 確定演出や入力再開条件の短縮
- 公開環境へのデプロイ

## 実装手順

### 1. placement feedback に所有者色を運ぶ

対象: `ui/network/action-bridge.ts`、`ui/network-client.ts`、`ui/network/placement-feedback.ts`、`ui/board-visual/types.ts`、`ui/board-visual/model.ts`

- 通常配置の送信者色を placement feedback へ渡す。
- preview hint へ省略可能な owner を追加する。
- raw envelope で消している経路を、canonical intake 戻り値を確認した後の exact room/session/operation handoff へ移す。
- 拒否、通信失敗、退出、session 変更の既存 cleanup は維持する。

完了条件: 送信直後に owner 付き仮表示が作られ、未検証 envelope では消えず、検証済み同一操作だけが確定表示へ引き継ぐ。

### 2. Pixi と DOM 互換表示を追加する

対象: `ui/pixi/hint-view.ts`、`ui/board-visual/model-builder.ts`、`ui/board-dom-compat/*`、`styles-board-dom-compat.css`

- Pixi hint layer に黒・白の半透明石と既存の水色リングを描く。
- DOM 互換 backend に同じ意味の owner class と半透明石を描く。
- owner を paint signature に含め、色変更時に描画が更新されるようにする。

完了条件: 両 backend で owner 色が一致し、owner なし caller は従来リングへフォールバックする。

### 3. 保存後 SSE fanout を response 待機から外す

対象: `utils/match-publish-controller.ts`、Worker/local adapter、関連型

- prepared projection、presentation frame、replay record を stage して `saveRoom()` が成功するまでは必ず待つ。
- 保存後は broadcast を即時開始し、adapter が deferral を明示したときだけ完了を HTTP response の待機条件から外す。
- 個別 writer timeout/error は既存 stream controller に任せ、controller rejection だけを adapter が処理する。
- deferral 未指定の harness は従来どおり await する。

完了条件: 保存失敗は成功応答せず、遅い writer は成功応答を遅らせず、Worker/local の外部契約が一致する。

### 4. 検証と生成物同期

- placement feedback / board model / Pixi / DOM の focused test を更新する。
- publish controller の save-before-response と deferred fanout を検証する。
- 遅い同一 writer への連続 publish で response、eventId 開始順、timeout close、replay/state recovery を検証する。
- network parity、型検査、Worker bundle smoke、`npm run worker:prepare`、mirror check、`npm run build:browser` を実行する。
- Chrome の classic lane / Pixi backend でクリック直後の仮石から確定演出への引継ぎを確認する。

完了条件: 関連テストと生成・mirror 検査が成功し、`http://127.0.0.1:8000/` をこの repository の play server が HTTP 200 で提供し続ける。

### 5. 最終レビューと着地

- task-owned diff、生成物、`git status --short` を確認する。
- 最初の設計レビューを行った独立 reviewer に最終 diff を再レビューしてもらう。
- 指摘を修正し、必要な再検証を行う。
- task-owned files だけを stage し、1つの coherent commit にする。

## 進捗・発見・判断

- 設計レビューで、送信時点に「合法」と断定できないこと、raw envelope を信頼できないこと、個別 writer failure は `sendSse()` 所有であること、連続 publish の検証が必要なことを確認した。
- 仮石の寿命は visual settlement 完了ではなく、検証済み canonical intake から確定 timeline/refresh へ引き継ぐまでとした。これにより確定演出を仮 overlay で覆わない。
- Worker の accepted response は replay artifact を含む room 保存までは待つ。省くのは保存後の各 SSE writer 完了待ちだけとする。

## 実施結果

- 通常配置の送信直後に owner 付き presentation-only preview を作り、検証済み canonical intake 後だけ確定 timeline/refresh へ引き継ぐようにした。raw envelope と raw success result は settlement に使わない。
- Pixi と DOM 互換 backend に黒・白の半透明仮石を追加し、owner を model、paint signature、input runtime の変更判定へ含めた。owner がない既存 caller は従来リングへフォールバックする。
- accepted publish は prepared viewer payload、frame、replay record を stage・保存した後に SSE fanout を開始し、Worker/local adapter が明示した場合だけ writer 完了を HTTP response の待機対象から外すようにした。
- focused UI は初回 100 件、最終 focused は 70 件、publish/stream focused は 25 件が成功した。`npm run build:ts -- --noEmit`、`npm run check:window`、`npm run test:network:parity` 36 suite / 585 件も成功した。
- `npm run worker:prepare`、`npm run check:worker-mirror`、`npm run worker:bundle:smoke` が成功し、classic/Vite・Pixi/DOM・normal/reduced-motion/noanim の browser playback check は 12 report / 232 scenario で成功した。
- 独立 reviewer の初回4指摘と最終2指摘を反映した。最終レビューで P1/重大問題はなく、owner-only preview 更新漏れを修正した。
- Chrome で `http://127.0.0.1:8000/index.classic.html` を時間を置いて4回試したが、Chrome 制御環境の管理ポリシー確認が利用できず接続前に拒否された。安全機構を迂回せず、直接の手動相当確認は未実施とする。HTTP 200、自動 browser playback matrix、focused presentation tests は成功している。
- 公開環境への deploy は行っていない。
