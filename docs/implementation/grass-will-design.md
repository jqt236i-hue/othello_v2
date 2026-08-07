# 草の意志 設計

## 目的

`草の意志`を、`種まきの意志`の派生となる通常入手可能な繁栄カードとして追加する。

- カードID: `grass_will_01`
- CardType: `GRASS_WILL`
- コスト: 20
- 次に置く石: 草石
- 草石: 反転無効、所有者ターン開始を10回迎えるまで持続
- 播種: 草石の配置時と、草石が存在する所有者ターン開始時に、合法な空きマスからランダムに1マスを選んで種を置く
- 発芽: 種の所有者ターン開始を5回迎えた時点で空きマスなら、同色の通常石として芽生え、通常の挟み反転を行う

## プレイヤー向け決定事項

1. 草石を置いた直後に1回播種する。この配置時処理では草石の残り回数を減らさない。
2. 所有者ターン開始時は、草石ごとに `createdSeq` 順で「播種してから残り回数を1減らす」。
3. 10回目の所有者ターン開始でも先に播種し、その後に草石を同色の通常石へ戻す。
4. 播種先は、現在の盤面形状に含まれる空きマスのうち、封鎖マスでも既存の種マスでもないマスとする。
5. 候補がない場合は播種せず、乱数も消費しない。草石の残り回数は通常どおり進む。
6. 種マスには通常どおり石を配置でき、発芽前に石が置かれた場合は種が消える。
7. 種は所有者ターン開始時だけ減算し、5回目に空いたままなら通常石として芽生える。芽生え石は既存の種まきの意志と同じく通常反転・布石獲得・反応効果を通す。
8. 草石は反転されないが、通常の破壊対象にはなる。延命・腐食・意志の喪失・捕獲・生きる意志などは共有特殊石規則に従う。
9. 草石が寿命以外で盤上から失われた後は播種しない。既に置かれた種は独立して残り、通常の種ライフサイクルを継続する。

## 既存仕様の整合

現在のcanonical実装と`正本/カード仕様正本.md`では、種まきの意志の発芽石は通常反転を行う。一方、`01-rulebook.md`と一部の表示カタログには旧仕様の「反転しない」と旧コスト12が残っている。

草の意志を派生カードとして一意に実装するため、種まきの意志のプレイヤー向け記述を現行仕様であるコスト7・通常反転ありへ揃える。草の意志の種も同じ共有ライフサイクルを使用し、カード由来だけをmarker dataに保持する。

## canonicalデータ

### 草石

`cardState.markers`へ次を保存する。

```text
kind: specialStone
owner: black | white
data:
  type: GRASS
  remainingOwnerTurns: 10
```

`GRASS`は共有特殊石registryで、真の特殊石・反転無効・通常破壊可・寿命操作可・所有権変更時通常石化として登録する。

### 種

既存の`SEED` markerを再利用し、草の意志由来だけ次のmetadataを追加する。

```text
data:
  type: SEED
  remainingOwnerTurns: 5
  sourceCardType: GRASS_WILL
```

種の減算、配置による消滅、発芽、通常反転は既存のstatus-cell timingを通す。発芽イベントの`cause`は`sourceCardType`を使い、既存の種まきの意志は未指定時に`SEED_WILL`へフォールバックする。

## 制御フロー

1. `GRASS_WILL`使用で既存の次置き石pending effectを保存する。対象選択stageは作らない。
2. 次の合法配置で`GRASS { remainingOwnerTurns: 10 }` markerを置く。
3. placement immediate dispatcherが配置した草石だけを処理する。
4. shape-awareな`getSeedTargets`候補をcanonical順に収集し、候補がある場合だけauthority PRNGを1回使って1マスを選ぶ。
5. 共通status-cell helperで`SEED` markerを置き、`STATUS_APPLIED`を発行する。
6. 所有者ターン開始時はmarker phaseの`createdSeq`順で各草石に4〜5を実行し、その草石の寿命を1減らす。
7. 残り0になった草石を`BoardOps.revertSpecialStoneAt`で同色通常石へ戻す。
8. 種は既存のturn-start status marker phaseで5回目に発芽し、shared spawn-and-flip lifecycleを通す。

各草石の播種と寿命更新は1つの`BoardOps.runEffectBlock`にまとめ、途中状態をcanonical snapshotへ見せない。

## 乱数・盤面トポロジー

- `Math.random`やUI乱数は使わない。
- placement・turn start・Worker・local server・headlessは、既存の注入random sourceを共有する。
- 候補抽出は`getSeedTargets`を再利用し、base board、盤面拡張、穴、封鎖、既存種を含むcanonical board topologyに従う。
- 候補が0件ならPRNG stateを進めない。
- 複数草石は`createdSeq`順に処理し、各時点の更新済み盤面から次の候補を再計算するため、同じマスへ重複播種しない。

## 表示・asset

- カード面: `assets/images/special-cards/backgrounds/grass_will_background.png`
- 黒草石: `assets/images/special-stones/grass-will-black.png`
- 白草石: `assets/images/special-stones/grass-will-white.png`
- 種マスと発芽: 既存の`SEED` status marker、spawn、flip presentationを再利用する。
- 草石の残り回数と反転無効表示: 共有特殊石render modelを再利用する。
- 新しいcanvas、DOM盤面writer、専用animation clockは追加しない。Pixi通常経路とDOM互換経路は既存のSingle Visual Writer境界内で同じvisual effect mappingを読む。
- 専用効果音や専用軌道演出は今回追加しない。既存のカード使用・status適用・発芽presentationを維持する。

## CPU・理論の化身・混沌

- CPUには、安定した草石を維持して将来石を増やす長期アンカー型profileを追加する。
- 対象選択カードではないため、CPU専用のseed target commandは作らない。通常のカード使用後、placement plannerで草石を置く。
- `GRASS`を真の特殊石registryへ追加するため、理論の化身・混沌の特殊石候補にも入る。
- 理論数字マスなどから草石が出現した場合も、その配置時に1回播種し、以後10回の所有者ターン開始で同じ処理を行う。

## ネットワーク契約

### 影響するtransition

- actor: 黒または白
- command: 既存card-use commandと既存placement command
- command identity: 既存の`operationId`、session epoch、base `stateVersion`
- pending identity: 対象選択がないため`pendingEffectId`は追加しない
- random authority: placement受理時と所有者ターン開始時にauthorityが候補を抽選する
- canonical mutation: `GRASS`、`SEED`、残り回数、発芽後board、`prngState`
- version: 受理した各command transitionで既存規則どおり1回だけ進める
- projection: black、white、spectatorへ既存marker/snapshot projectionで同じ公開情報を配る
- presentation: ordered canonical eventからviewer frameを組み立てる
- reconnect: canonical marker、board、`prngState`、presentation journalから復元する
- board contract: topology/schemaを変えないため`boardContractVersion`は据え置く

新しいaction kind、client-authored結果、client乱数、秘密情報は追加しない。`GRASS`はturn startに盤面を変え得るmarkerとしてnetwork turn handoffの判定へ追加する。

## 互換性と失敗時動作

- 既存snapshotに`GRASS`がなければ挙動は変わらない。
- 新markerは既存の汎用marker projectionで搬送する。
- random source、target resolver、status-cell apply、BoardOpsが欠ける場合は成功形にせず明示的に失敗させる。
- 播種候補0件だけは正常な不発として扱う。
- root sourceを正本とし、browser生成物とWorker mirrorは既存generatorで同期する。

## 検証方針

- catalog、CardType、表示文、数値タグ、カード背景path
- 特殊石registry、visual mapping、marker factory
- focused headless: 配置、配置時播種、turn-start播種、10回目の順序、反転無効、通常破壊、候補0、PRNG消費、複数anchor順序
- shared seed lifecycle: 5回目発芽、配置による消滅、通常反転、草石消失後も種が残る
- 延命・腐食・意志の喪失・捕獲・生きる意志との共有契約
- CPU all-card profile/taxonomy、AUTO placement
- Worker preload、local/Worker/headless parity、network projection/reconnect
- typecheck、window boundary、browser build、Worker prepare/mirror/bundle

## 完了条件

- 草の意志がコスト20の繁栄カードとして有効catalog、全カードpool、custom deckで利用できる。
- 次の石が草石になり、配置時と各所有者ターン開始時にauthority抽選で種を1つ置く。
- 草石は10回目の所有者ターン開始でも播種した後、同色通常石へ戻る。
- 種は5回目の所有者ターン開始で同色通常石として芽生え、既存の通常反転を行う。
- 反転無効、通常破壊、寿命操作、捕獲、意志の喪失が共有特殊石規則どおりに動く。
- Pixi、DOM互換、headless、CPU、local authority、Worker authority、再接続snapshotが同じcanonical結果を扱う。
- 仕様、root source、生成物、Worker mirrorが同期し、タスク所有差分だけをコミットできる。

## Self-review

初稿では草の意志専用の種markerと発芽processorを追加する案があったが、種まきの意志との挙動差と二重管理を生むため採用しない。既存`SEED`へ由来CardTypeだけを追加し、発芽のcause以外は同じライフサイクルを通す。

また、ランダム対象をUIで先に選んで送る案はauthority契約と再接続再現性を壊すため採用しない。候補が存在するときだけcanonical PRNGを消費する。表示は既存markerとvisual effect mappingで足りるため、新しい盤面writerや専用animation stateも追加しない。

