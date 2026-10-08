# CPUの移植契約と比較基準

役割: 採用CPUの入力・判断・モデル・検証を引き継ぐ資料。ルールの一次情報は [01-rulebook.md](../01-rulebook.md)、CPU責務は [architecture-contracts.md §4.5](architecture-contracts.md)。新CPU開発、追加学習、Godotでの性能保証は対象外。

## 採用範囲

開始HEAD `bfd7ee626` の [cpu-opponent-profiles.ts](../shared/cpu-opponent-profiles.ts) が画面で選択できるLv1〜12を列挙する。Lv10/11のソースコメントに残るdevelopment表現から採用可否を推測せず、実際のprofileとWorkerの接続を採用根拠にする。Lv13と既存dirtyな `cpu-tactical-safety.ts`、`cpu-turn-move-phase.ts` 等の性能作業は未採用。保存パッケージでは開始HEADと今回分だけを重ねる。

| 画面レベル | 判断と開始条件 |
| --- | --- |
| 1〜5 | 各decisionLevel。共通のカード評価・合法手・配置選択を使う |
| 6 盤理の観測者 | decisionLevel 6、lv6-defaultデッキ |
| 7 盤界の執行者 | decisionLevel 6、lv6-board-executorデッキ |
| 8 理論の化身 | decisionLevel 6、専用デッキ、白の初期布石50、カード解禁turnNumber 8 |
| 9 終焉の冥灰 | decisionLevel 6、全有効カードデッキ、両者初期布石99、布石取得倍率2、解禁turnNumber 6 |
| 10 観測ダークドラゴン | Lv9と同じ開始条件、独立したLv10探索 |
| 11 執行エグゼキューションカオスドラゴン | Lv9と同じ開始条件、独立したLv11探索 |
| 12 理論カオスロジカルエンペラービースト | Lv9と同じ開始条件、独立したLv12探索 |

正規profile ID、左右別初期条件、デッキ列は [CPU固定比較JSON](../test/fixtures/godot-cpu-search.json) の `profiles` に展開済み。設定の明示値がprofile既定値に優先する。Lv8の左右差をLv9以降へ誤って持ち込まない。

## 境界と合法性

Lv10〜12の唯一の観測入口は [observeLv10Position](../game/ai/cpu-lv10-observation.ts)。既存authorityで閲覧者へ投影してから渡し、非公開の相手手札・山札順・対局PRNGを送らない。`cpu_lv10_observation.v1` にplayer、gameState、cardStateを格納する。公開デッキrecipeは別項目。非公開部分は独立scenario seedから仮想局面へ復元する。仮想局面の確定結果を実対局へ直接コピーしない。

候補は [cpu-lv10-position.ts](../game/ai/cpu-lv10-position.ts) の既存列挙・配置合法手から作り、card/pending/place/passは正本pipelineで評価する。実適用前は [cpu-lv10-turn.ts](../game/cpu-lv10-turn.ts) で手番、controller、世代、profile、公開観測を再確認する。退出・別対戦・対象変化後のWorker応答を採用しない。FATEでは手番所有者と操作controllerを区別する。

探索の返値はaction、continuation、value、transitions、elapsedMs、stopped、rejectedCount等。valueは探索の評価値であり勝率保証ではない。例は固定比較JSONの `records[].result`。探索失敗は明示した `source: fallback` とerrorで記録し、上限20msの安価な合法操作選択に退避する。画面threadで同じ重い探索を再実行しない。

Lv13は1手番の探索で4600msを共有し、各要求に手番の残り時間を `maxMs`（最低100ms）として付ける。2操作目以降は、実際の公開観測が「直前の操作を最初の仮想局面（seed 100901）に適用した予測」と項目順を問わず一致する間、continuationの次の操作を探索せずに使う（その仮想局面で合法を確認）。外れ・拒否・古い応答で手順を捨てて探索し直す。Lv10〜12は操作ごとに探索する。正本は [cpu-lv10-turn.ts](../game/cpu-lv10-turn.ts) の `Lv10PlanMemory`。

## 探索量と実時間

| 探索 | version | 本番上限 |
| --- | --- | --- |
| Lv10 | lv10-canonical-beam-dev7 | 1024遷移 / 1500ms |
| Lv11 | lv11-sparse-endgame-dev5 | 4096遷移 / 4800ms |
| Lv12 | lv12-a04-additional-complete-root | 4096遷移 / 4800ms |

拒否操作とturn-startを含む実行した全pipeline遷移を数える。clockは処理境界で判定するので1処理分超過し得る。beam幅、候補上限、scenario seed、Lv12追加探索枠は固定比較JSONの `config` を参照。

Lv6系は [cpu-lv6-shared-profile.ts](../constants/cpu-lv6-shared-profile.ts) の `teacher_lv6_parity_v5`。通常配置はothello-onnx、カードはpolicy-table-core、白の最低思考表示250ms。ブラウザの白配置/終盤lookahead上限1250/1800ms、黒1000/1500ms。これは学習teacherの80/160msとは別設定。ONNX遅延guardも同資料にあり、計測が低速なら無制限に待たない。

## モデルと特徴量

採用ファイルは [model-assets.json](../data/models/model-assets.json) の限定リスト。全モデルとメタデータを実ファイルで保全し、hashは収集manifestと [実推論JSON](../test/fixtures/godot-cpu-models.json) に記録する。モデル欠損は成功として扱わない。

| モデル | 入出力・特徴量 |
| --- | --- |
| othello/policy-value.onnx | float32 `[1,80]` のobs。行優先64マスを自分1/相手-1/空0、64〜76は合法手数/30、石差/64、各石数/64、空き/64、各隅数/4、各辺数/28、色sign、opening/mid/endフラグ。77〜79は0。出力logits `[1,64]` とvalue。順序は `othello-onnx-runtime.ts` のbuildInputVector |
| policy-net.onnx | metadataのpolicy_onnx.v1。現行入力282、base116、10×10 padded盤（-1〜8）100マス＋補助16、metadataで順序固定されたカード手札数/使用可能flag/pending type。配置出力100。正本encoderは `policy-feature-vector.ts`。モデルへ新カード次元を勝手に追加しない |
| policy-table.json / othelloのpolicy-table・value-table | 採用runtimeの表参照とfallback。新モデルの代替生成物ではない。全ファイルとschemaを保存 |
| Lv12評価係数 | `cpu-lv12-model.ts` の36係数と `cpu-lv12-evaluation.ts` の36特徴量。係数・名前・固定局面の実値を固定比較JSONに展開。公開仮想局面だけから抽出 |

行・列からのONNX配置indexは8×8で `row*8+col`、padded10ではmetadataの原点を引いて10倍する。合法手maskと候補順、同点時の行列順を保つ。float32への丸め、NaN拒否、合法手外のlogitの扱いも再現する。推論後のrerankはモデル内ではなくJavaScript側で実行するため、重みだけの移植では同一判断にならない。

## 短時間の再実行

ビルド後に以下を実行する。出力先の上書きは拒否する。

```text
node dist/scripts/godot-cpu-benchmark.js check
node dist/scripts/godot-cpu-benchmark.js timed output/new-cpu-timing.json
node dist/scripts/godot-cpu-benchmark.js models output/new-cpu-models.json
node dist/scripts/godot-cpu-benchmark.js compare-models output/new-cpu-models.json
node dist/scripts/godot-cpu-benchmark.js compare output/godot-cpu-result.json
```

固定量: 初期盤、少数石終盤、自由配置の3局面×Lv10〜12、上限128遷移、clockなし。各2回を一致比較し、入力不変・返した操作の合法性を確認する。JSONには入力観測・recipe・全結果・特徴量を収録する。Lv1〜6共通の安価なselectorも別に比較するが、これは各profileのブラウザ手番全体ではない。実際のLv6推論・応答は [ブラウザ検証](godot-port-presentation-lifecycle.md) も参照する。

実時間: 同じ局面で100msのclock予算を渡す。実測値は `output/godot-port-preparation/cpu-timed.json`。今回ローカルの9判断は約98〜103ms、29〜86遷移。並行負荷・機器に左右される性能証拠で、固定量の正解JSONやGodotの速度保証に混ぜない。

実モデル: モック出力を使わずONNX Runtime WASMで2モデルを実行。既存の特徴量encoderと出力選択を呼び、入力vector・tensor出力・選択・重みhashを保存する。`compare-models` は出力tensorのfloatだけ相対/絶対1e-5を許容し、モデルhash・入力・選択・case数は厳密一致。例外やmodel missingは終了コード1。学習用データ生成も追加学習も行わない。
