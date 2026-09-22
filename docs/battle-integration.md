# カードリバーシの戦闘組み込み契約

現行の公開API・保存・配布物の利用手順。ゲームのルールは [01-rulebook.md](../01-rulebook.md)、責務の正本は [architecture-contracts.md](architecture-contracts.md)。物語・報酬・Steam機能はホストが所有する。カード効果やCPUの思考方法を変更するAPIではない。

## 公開入口

`npm run build:battle-package` で `output/battle-package` を生成し、`npm pack ./output/battle-package --pack-destination ./output` で非公開のローカル配布物を作る。`@card-reversi/battle` はCommonJSのcoreと型、`@card-reversi/battle/host` はブラウザ用ES moduleと型を公開する。内部の深いパスをconsumerから参照しない。ブラウザ用ONNXのJS・WASM・JSEPとモデルも成果物へ含める。既存のONNX先行読込経路を確認する場合はゲームURLに `eagerCpuPolicy=1` を指定する。通常の読込方針自体は変更していない。

```ts
import { createBattle, restoreBattle, serializeBattleSave, parseBattleSave } from '@card-reversi/battle';
const battle = createBattle({ version: 1, battleId: 'chapter1-encounter1', seed: 914001,
  players: { black: { controller: 'human' }, white: { controller: 'cpu', profile: '10' } } });
battle.startTurn(); // 完了済みのターン開始には再適用しない
const saved = serializeBattleSave(battle.exportSave());
battle.dispose();
const resumed = restoreBattle(parseBattleSave(saved));
```

`apply` は既存pipelineの操作（`place`、`use_card`、`pass`等）を受け、採用／拒否と理由・前後状態・イベントを返す。次の手番への移行後は `startTurn()` が必要。`currentPhase` は `needs-turn-start` / `action` / `terminal`。`result()` は未終了ならnull。内部利用の `BattleMatch` は検証済み状態専用で、明示的なターン開始を必要とする旧ProductionMatch互換の入口。外部の保存入力は `restoreBattle` を通す。

coreはCPUのスケジュール、描画、保存先を実行しない。結果は連続パスによる正本の終局から得る。満盤だけでは終了にしない。状態・条件・保存データはコピーで渡す。破棄後の操作・保存・CPUメモリー更新は拒否する。

## 設定

`BattleConfig.version = 1`。seedはuint32、battleIdは128文字以内の英数字と `_.:-`。省略時は8×8通常盤、黒は人、白はCPU Lv1。CPU profileは正規IDか既存レベルを指定し、正規IDとして保存する。明示したデッキ・初期布石・布石倍率がprofileの初期値に優先する。0と空デッキは有効。未指定値は現行factoryの既定値を維持する。

盤面サイズ・形状は既存の盤面設定の対応範囲。`initialLayout` は盤内の通常石と先手だけを指定し、石IDを同期して生成する。初期特殊石や独自の穴・勝利条件は未対応で、設定フィールドとして受け付けない。盤面拡張・特殊石の戦闘中の変化は既存のカード処理が担当する。

## 画面・終了・中断

```ts
import { mountBattle } from '@card-reversi/battle/host';
const view = mountBattle(container, './vendor/browser/index.html', configOrSave);
await view.ready;
const outcome = await view.finished;
// kind: finished / cancelled / error
view.dispose();
```

`browser/` 全体をホストと同じoriginの配下に置く。初版画面は黒が人、白が人または既存CPUの構成。黒CPUはcoreでは指定できるが、この画面adapterは拒否する。Viteの既存UI・Pixiを使い、明示的DOM compatibilityも検証対象。通常の既存classic画面は維持するが、組み込みAPIの配布入口はViteのみ。

一つのcontainerへ重複mountできない。一戦ごとにiframeのdocumentを作り、退出時はCPU Worker、予約処理、描画runtimeとdocumentを破棄する。再戦は新documentへmountする。既存の「page runtimeを破棄した後は再生成不可」という契約を維持し、使い終わったpageを復活させない。ホスト自身の寿命と戦闘documentの寿命は別。

結果は既存の結果表示経路から通知を受け、正本の終局と演出キュー・playback claim・入力処理の完了を確認して一度だけ通知する。タイムアウトや演出失敗はerrorであり、勝敗ではない。標準結果画面・観測石の報酬は組み込み時に実行しない。resultIdは `battleId:result`。ホストはbattleIdを再利用せず、進行とresultId受領を同一保存世代で確定する。

`save()` は操作と演出が完了した境界を待つ。対象選択待ちも保存できる。CPU思考・演出中の要求は境界まで待ち、120秒で到達しなければ失敗を返す。退出時は必ず `dispose()` を呼ぶ。ready待機中でも破棄可能。キャンセルを勝敗として扱わない。

## 保存・互換・復旧

形式1は解決済み設定、全正本状態、乱数seed/calls、進行phase、CPU継続メモリーを保持する。描画キュー・関数・結果表示フラグは含めない。復元で開始済みターンのドロー・効果・過去の演出を再実行しない。ルール識別とカード内容の識別はpackage版・保存形式版とは別である。

初版fixtureは [battle-before-refactor.json](../test/fixtures/battle-before-refactor.json) の変更前操作列と保存往復テストで固定する。今後ルールを変える場合は `BATTLE_RULES_VERSION` を更新し、旧保存fixtureへの移行テストを追加する。未知の形式／ルール／内容は明示的に拒否し、空の新規対戦として読み込まない。JSONは8 Mi文字、300,000ノード、深さ80、乱数checkpointは10,000,000 calls以内。チェックサムは破損検出であり不正改ざん防止ではない。

`createBattleStorage(port, prefix)` のportはread/writeと全writerを覆うexclusive lockを必須とする。各キーのwriteはatomicであること。2スロットとmanifestで確定し、破損時は直前の互換世代へ戻り `recovered` を返す。未知の将来版を古い版で上書きしない。容量不足やアクセス拒否は失敗として返す。ブラウザadapterはWeb LocksとlocalStorageを使用する。

サンプルのファイルadapterはElectron main processの単一所有者で書き込みを直列化し、同一ディレクトリの一時ファイルをflush→renameしてmanifestを確定する。進行・報酬受領ID・戦闘保存は一つの記録。初回読込成功までは開始を無効化し、外側の進行形式も将来版なら拒否する。戦闘runtimeの異常は最後の保存を残して会話へ戻り、結果の保存失敗は戦闘を保持して保存を再試行できる。OS／媒体自体の故障まで保証するものではない。

## 独立サンプルと更新

[examples/story-host](../examples/story-host/package.json) はTypeScript＋ElectronによるWindows接続サンプルの正本。新しい作業先にコピーし、`vendor/card-reversi-battle-0.1.0.tgz` を置いて `npm install` → `npm run build` → `npm start`。Electronのインストールがbinaryを取得しなかった環境では `node node_modules/electron/install.js` を実行する。`npm test` はファイル保存復旧、`npm run package` はローカル配布フォルダーを作る。

生成されたpackage-lockのintegrityと `PACKAGE-MANIFEST.json` の各ファイルSHA-256で取り込んだ版を固定する。manifestはdirtyなソースも含む実ファイルのdigestを記録し、HEADだけを再現根拠にしない。更新時は旧tgzとセーブを保全し、新成果物を別名／版で取り込み、型・対戦・保存互換・オフライン画面を確認してから切り替える。切り戻しでは新しい形式のセーブを旧版に無断で渡さない。

サンプルの配布方法は [Electron公式のprebuilt binary構成](https://www.electronjs.org/docs/latest/tutorial/application-distribution) を使用する。署名、Steam販売登録、実績／Cloud、Steam Deck・コントローラー対応はこのサンプルでは採用していない。素材の商用配布権は個別に確認が必要であり、packageのprivate指定やソースのlicenseを素材全体への許諾と扱わない。配布物は追跡済みの実行時画像・音・フォント、明示したモデル、ビルド済みJSだけを収集し、制作資料・Blenderファイル・学習ログを取り込まない。`PACKAGE-MANIFEST.json` を素材台帳の起点にし、販売前に出典・許諾を補う。
