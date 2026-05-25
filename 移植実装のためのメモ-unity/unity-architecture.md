# Unity 移植アーキテクチャ

Unity 版は、ルール処理と表示処理を明確に分離する。初期移植ではオンライン対戦を実装しないが、将来サーバー権威へ移せる構造を保つ。

## レイヤー

```text
AppFlow
  タイトル、モード選択、設定、リザルト、シーン遷移

UnityPresentation
  BoardView、HandView、CardDetailView、ResultView、AnimationPlayback、AudioPlayback

GameCore
  MatchState、TurnPipeline、CardEffectResolver、BoardOps、CpuDecisionEngine、ResultScoring

Data
  CardCatalog、GameConstants、AssetMap、SaveData、LocalCurrency
```

## シーン構成の最小範囲

初期移植で必要な画面は次を最小範囲とする。

- タイトル
- モード選択
- ローカル対戦設定
- CPU 対戦設定
- リバーシモード設定
- ゲーム画面
- カード詳細
- ルール説明
- ポーズ
- 設定
- リザルト

ランキング、オンライン対戦、ガチャ、ストーリー、デッキ作成へのボタンや未実装画面は初期移植では置かない。

リバーシモードのゲーム画面では、カード・デッキ・手札・布石・数字マス・特殊石・カード由来効果を無効にし、カードリバーシ専用 UI を非表示にする。

## GameCore

GameCore は純粋 C# として実装する。Unity 固有 API に依存しない。

禁止:

- `MonoBehaviour`
- `GameObject`
- `Transform`
- `Coroutine`
- `Time.deltaTime`
- `UnityEngine.Random`
- Audio / Particle / Animator の直接操作

許可:

- plain C# class / struct
- enum
- List / Dictionary
- 明示的な RNG interface
- シリアライズ可能な DTO

GameCore の基本形:

```text
MatchState + GameCommand + DeterministicRng + Catalog/Constants
  -> MatchResult

MatchResult:
  - NewMatchState
  - PresentationEvent[]
  - PendingSelection?
  - ValidationError?
```

## GameCommand

UI と CPU は同じコマンドを GameCore に渡す。

代表コマンド:

- `StartMatchCommand`
- `ResetMatchCommand`
- `UseCardCommand`
- `CancelCardCommand`
- `PlaceStoneCommand`
- `SelectBoardTargetCommand`
- `SelectHandTargetCommand`
- `SelectCandidateCardCommand`
- `ConfirmPendingSelectionCommand`
- `CpuAutoCommand`
- `ShowResultCommand`
- `CloseResultCommand`

マウスクリック、タップ、キーボード、CPU 判断は、GameCommand へ変換してから GameCore に入れる。UI イベントから盤面や手札を直接書き換えない。

## UnityPresentation

UnityPresentation は、GameCore の状態と presentation event を画面へ反映する。

- 盤面を描画する。
- 手札を描画する。
- 対象選択可能セルを表示する。
- `PresentationEvent[]` を順番に再生する。
- 再生完了後、最終 `MatchState` と表示を同期する。

UnityPresentation はルール判定を持たない。見た目上のアニメーション中にゲーム結果を変えてはいけない。

## Effect Block と PresentationEvent

JS 版では、複数の表示上意味がある盤面変化や救済タイミングがある処理に `BoardOps.runEffectBlock()` が使われる。Unity 版でも同じ考え方を持つ。

- 1 つのカード効果またはターン開始 anchor を 1 つの effect block として扱う。
- 破壊だけの batch、破壊+穴化、spawn は別種の block として区別できるようにする。
- 救済神の復活は、元の破壊と同じ effect block の文脈を保持する。
- `effectBlockId` は表示メタデータであり、ゲーム勝敗や合法手判定の正本にしない。

## AppFlow

AppFlow はゲーム外の導線を担当する。

- タイトル
- モード選択
- ローカル対戦設定
- CPU 対戦設定
- リバーシモード設定
- ゲーム開始
- ポーズ
- 設定
- リザルト

初期移植ではランキング、オンライン、ガチャ、ストーリー、デッキ作成への導線を作らない。

## データ読み込み

カード catalog は JSON 由来の importer で読み込む。ScriptableObject へ変換する場合も、生成元は `cards/catalog.json` とし、差分確認手順を残す。

読み込み対象:

- `cards/catalog.json`
- 定数相当の `GameConstants`
- 特殊石見た目の AssetMap
- 音声/演出 profile の AssetMap
- ローカル保存された観測石所持数

ScriptableObject は Unity 側のキャッシュまたは編集補助として扱い、正本にしない。

## 将来オンライン化への備え

初期移植ではサーバー通信を作らない。ただし、以下は守る。

- UI 入力は `GameCommand` として表現する。
- GameCore は deterministic にする。
- MatchState は snapshot 化できるデータにする。
- RNG seed を MatchState または TurnContext から追跡できるようにする。
- presentation event はゲーム結果ではなく表示命令として扱う。
