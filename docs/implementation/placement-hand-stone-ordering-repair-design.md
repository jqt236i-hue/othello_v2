# 手置き演出より石が先に出る回帰の根本修正 設計

## 1. 文書の役割

この文書は、盤面クリック直後に確定石が表示され、その後から手置き演出が見える回帰を根本修正するための実装設計である。

- プレイヤー向け表示仕様の正本: `01-rulebook.md` と `正本/演出正本.md`
- 内部責務境界の正本: `docs/architecture-contracts.md` 7.3
- 実装対象: ローカル盤面描画の playback 待機判定と browser runtime state 参照
- 非対象: canonical 着手結果、`events[]` の意味順、手モーションの長さ、接触後の `spawn` / `flip` 間隔

## 2. 再現事実と根本原因

実ブラウザの通常対局で着手を計測したところ、次の順序を確認した。

1. 着手結果と `PLAYBACK_EVENTS` が現在の `globalThis.cardState` へ反映される。
2. `AnimationEngine` が writer を claim する前の同期通知で `renderBoard()` が呼ばれる。
3. 現在の `cardState` に再生待ちがあるにもかかわらず、board renderer が確定盤面を描画する。
4. その後に手置き演出が開始する。

根本原因は二段階にあった。

1. `ui/board-renderer.ts` の待機判定は、browser root に公開された現在の `cardState` より先に、無修飾の legacy `cardState` binding を参照していた。Vite lane では `entry-browser.js` が ESM として読み込まれ、module-local binding と `globalThis.cardState` が別オブジェクトになり得る。着手処理と presentation queue は現在の root object を更新しているため、board renderer が古い binding の空キューを読み、Single Visual Writer の保護をすり抜けていた。
2. current state を読んで synthetic writer を正しく claim した場合でも、`flushBoardPresentationEvents()` が queue drain 前に通常の `getBoardVisualControllerReady()` を待つと、その API が synthetic writer を最終 canonical frame で settle していた。直後の presentation drain は新しい writer を claim できるが、石はすでに先出し済みになる。

## 3. 望ましい結果

1. クリック直後は最終石・最終手番・最終カウントを盤面へ先出ししない。
2. 手が着手点へ到達するまでは playback writer が盤面表示を所有する。
3. 手が石を置く接触タイミングで完成状態の石を表示し、追加待機なく `spawn` / `flip` へ進む。
4. Pixi 通常経路と DOM compatibility 経路が同じ current-runtime-state 規則を使う。
5. classic lane や単体テストで browser root object がない場合だけ legacy binding へフォールバックする。

## 4. 選択肢

### A. 手演出完了まで石表示を遅らせる

退避まで待つため、接触後に余分な待機が発生し、既存の約0.44秒テンポと仕様に反する。根本原因である誤った state 参照も残るため採用しない。

### B. 着手結果を一時的に隠す overlay を追加する

第二の盤面表示制御と settlement path を生み、Single Visual Writer を弱める。ほかの再生イベントでも同じ先出しが再発し得るため採用しない。

### C. browser root の current runtime state を一元解決して playback gate に使う

現在の presentation queue を正しく読み、既存 writer claim と deferred frame の仕組みをそのまま働かせられる。通常・compatibility の両経路と state adapter で共有でき、同型の回帰を防げるため採用する。

## 5. 設計

### 5.1 current runtime object resolver

`ui/runtime-state-access.ts` に UI runtime 専用の小さな resolver を置く。

1. `globalThis` の指定 key が object ならそれを返す。
2. 別 root として `window` が存在する環境では同じ key を確認する。
3. current root object がない場合だけ、呼び出し側が渡す lazy legacy resolver を評価する。
4. いずれも利用できなければ `null` を返す。

legacy binding は current root 探索後まで評価しない。これにより ESM-local の古い参照が、現在の browser root state を上書きしない。

### 5.2 board rendering への適用

- `ui/board-renderer.ts` の local `gameState` / `cardState` 解決と playback gate は共通 resolver を使う。
- playback gate は network visual snapshot ではなく、presentation queue を保持する current runtime `cardState` を読む。
- `ui/board-visual/state-adapter.ts` の local render pair も current root を優先し、network visual snapshot と prepared state の既存優先順位は変えない。
- `ui/board-dom-compat/renderer.ts` の local render pair、render state、playback gate も同じ規則に揃える。

### 5.3 所有権とタイミング

着手処理は従来どおり canonical result と ordered `PLAYBACK_EVENTS` を生成する。現在の queue を検出した board renderer は既存の synthetic writer / deferred update 経路へ入り、AnimationEngine の claim まで最終 frame を描かない。

presentation queue drain には通常の readiness API と分けた `getBoardVisualControllerReadyForPresentationDrain()` を使う。この API は backend readiness と pending writer claim の確定だけを待ち、synthetic writer を settle しない。queue を flush した後の drain claim が `claimBoardVisualWriter()` を通じて同じ token を reclaim し、そのまま AnimationEngine へ渡す。flush 結果に playback がなければ既存 finally 経路が auto writer を settle する。

手置き演出の approach が接触点へ達した時の callback、配置音、`spawn` / `flip` 開始時刻、退避モーションは変更しない。

## 6. 検証戦略

1. resolver 単体テストで current root object が stale legacy fallback より必ず優先されることを確認する。
2. board renderer と DOM compatibility の source contract test で playback gate が共通 resolver を通ることを固定する。
3. presentation-drain readiness のテストで synthetic writer が settle されず、その後の通常 readiness では settle できることを確認する。
4. focused board / animation Jest を実行する。
5. typecheck と browser build を実行する。
6. 実ブラウザでクリック、手の approach、接触時の石表示、後続反転の順を時系列計測する。

## 7. リスクと対策

- network visual store の表示 snapshot と current canonical state の混同: render model は従来どおり prepared state / visual store を優先し、playback queue の有無だけ current runtime `cardState` を読む。
- classic lane の互換性: classic では browser root と legacy binding が同一であり、結果は変わらない。root object がない isolated test だけ lazy fallback を使う。
- DOM compatibility の drift: 同じ resolver を利用し、fallback backend だけ古い参照順へ戻ることを防ぐ。
- 新しい writer や animation clock: 追加しない。既存の controller、AnimationEngine、settlement を再利用する。

## 8. 完了条件

1. クリック直後、手が着手点へ到達する前に確定石が表示されない。
2. 接触時に完成状態の石が表示され、後続 `spawn` / `flip` に追加待機がない。
3. current browser root state が legacy binding より優先される。
4. Pixi と DOM compatibility の playback gate が同じ参照規則を使う。
5. focused Jest、typecheck、browser build、実ブラウザ確認、diff check が成功する。

## 9. Self-review

- 最初の案にあった「手演出側で待機を増やす」を除外し、観測された誤参照そのものを修正対象にした。
- playback queue と render snapshot は責務が異なるため、current canonical queue を読む箇所と visual store を読む箇所を分けた。
- Pixi だけを局所修正すると fallback で再発するため、state adapter と DOM compatibility も同じ resolver へ統一した。
- current root がない classic / isolated runtime の互換 fallback を残しつつ、fallback の評価順を契約としてテスト可能にした。
- readiness と presentation handoff の責務混在を見落としていた初期案を修正し、synthetic writer を settle する通常待ちと、再生へ譲渡する drain 待ちを別APIにした。
- canonical logic、network authority、イベント順、手演出の時間は変更せず、UI の Single Visual Writer 境界内に変更を限定した。
