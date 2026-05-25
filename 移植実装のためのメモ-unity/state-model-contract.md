# Unity 移植 State Model Contract

この文書は、Unity/C# 版で保持する状態モデルの契約を定義する。名前は仮であり、実装時に C# 命名へ変えてよい。ただし責務は分ける。

## MatchState

対局全体の正本。

- `matchId`
- `board`
- `players`
- `currentPlayer`
- `turnIndex`
- `roundIndex`
- `phase`
- `pendingSelection`
- `rngState`
- `eventLog`
- `settings`
- `winner`
- `endReason`

`MatchState` は GameCore の唯一の正本であり、Unity の View 状態を正本にしない。

`rngState` は対局中の deterministic RNG の正本である。別名の PRNG 状態を併存させず、必要な派生 seed はここから追跡する。

## BoardState

盤面の正本。

- `cells`
- `baseWidth`
- `baseHeight`
- `activeShape`
- `expansionState`
- `shrinkState`

盤面拡張/縮小があるため、固定 8x8 前提の配列だけにしない。座標は JS 版の行/列または正規化済み座標に対応できる形にする。

ベース盤面は縦横 `4..10` を許可する。盤面拡張カード / 盤面拡張神による外側マス追加は、このベース盤面サイズ上限とは別枠で管理する。

## CellState

1 マスの状態。

- `position`
- `kind`
- `stone`
- `markers`
- `isHole`
- `isBlocked`
- `isFrozen`
- `numberValue`
- `numberConsumed`
- `seedState`

`kind` の例:

- normal
- expanded
- hole
- blocked

`numberValue` は対局開始時に確定し、石を置いた時点で消費済みになる。破壊で空きに戻っても復活しない。

## StoneState

石の状態。

- `owner`
- `stoneKind`
- `specialType`
- `markers`
- `remainingTurns`
- `flipProtection`
- `destroyProtection`
- `metadata`

通常石、特殊石、爆弾、救済神、龍、多動系などを同じ抽象で扱う。特殊挙動は `specialType` と marker で表す。

## PlayerState

プレイヤー状態。

- `playerId`
- `color`
- `seeds`
- `hand`
- `deck`
- `discard`
- `usedCards`
- `visibleHandInfo`
- `revealedCards`
- `handLimit`
- `flags`
- `riboRepayments`
- `fateOverride`

初期移植ではデッキ作成機能を実装しないため、deck は固定ルールから生成する。

デフォルトデッキは対局開始時に有効カードから 30 種を選ぶ。黒白でカード種は共通、山札順は別シャッフルにする。

初期手札は黒白とも 0 枚、手札上限は 5 枚。5 枚時の通常ドローは失敗し、そのドロー機会は消える。

## CardCatalogEntry

カード定義。

- `id`
- `type`
- `nameJa`
- `cost`
- `descriptionJa`
- `enabled`
- `displayTypeJa`
- `tags`

正本は `cards/catalog.json`。Unity 側の定義は importer または検証可能な転記にする。

現行 catalog は 87 件、有効 81 件、`enabled:false` 6 件。`display_type_ja` は 採掘 / 禁忌 / 戦闘 / 守護 / 執行 / 殲滅 / 特殊 / 繁栄 / 観測 を持つ。

## CardInstance

手札や山札に入るカード個体。

- `instanceId`
- `catalogId`
- `type`
- `owner`
- `createdTurn`
- `metadata`

同じカード type でも、手札表示や生成元を追跡できるように個体 ID を持つ。

## PendingSelection

対象選択中の状態。

- `cardInstanceId`
- `cardType`
- `owner`
- `kind`
- `stage`
- `targets`
- `selectedTargets`
- `canCancel`
- `turnOutcome`
- `dispatchKey`
- `waitForPlaybackIdle`
- `minimumCount`
- `metadata`

複数段階選択、手札選択、盤面選択を同じ pending として扱う。

オンライン対戦は初期実装しないため `deferNetworkPublish` の通信処理は不要。ただし、選択完了まで効果確定を待つ状態契約として pending は必ず保持する。

## TurnContext

1 回の処理単位で使う一時情報。

- `activePlayer`
- `turnIndex`
- `command`
- `rng`
- `events`
- `destroyedStones`
- `spawnedStones`
- `movedStones`
- `effectBlockId`
- `flags`

永続状態に入れるものと、一時処理用の値を混ぜない。

## PresentationEvent

表示再生用のイベント。

- `type`
- `phase`
- `source`
- `targets`
- `payload`
- `order`
- `effectBlockId`
- `soundCue`

PresentationEvent はゲーム結果の正本ではない。GameCore が確定した結果を、UnityPresentation が順番に見せるためのデータ。

## Hidden / Revealed Hand Info

初期移植ではオンライン対戦を実装しないが、観測の意志、断罪の意志、天の恵みなどは手札や候補の表示範囲を扱う。

- ローカル対戦では両者の入力者が同じ端末を使うため、UI 上の非公開表現は演出/UX として扱う。
- CPU 対戦では CPU 側手札の見え方と GameCore の完全情報を分ける。
- `REVEAL_HAND_WILL` は使用時点の相手手札だけを公開し、その後に引いたカードへ公開状態を広げない。
- `CONDEMN_WILL` と `HEAVEN_BLESSING` は hand overlay / candidate overlay として pending selection と同じ扱いで状態化する。

## SaveData

ローカル保存。

- 音量
- 演出速度
- 言語
- CPU 難度
- 直近の対戦設定
- ルール説明既読
- 観測石所持数

ランキング、オンライン、ガチャ、ストーリー、デッキ作成に関する保存領域は初期移植では作らない。

観測石所持数は CPU 対戦リザルトの獲得表示と保存にだけ使う。ガチャ消費、ランキング送信、オンライン対戦報酬とは接続しない。
