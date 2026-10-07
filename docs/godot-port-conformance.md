# Godot 移植用の決定論比較

この資料は、移植先と現在の headless 対局基盤を比較するための実行契約です。正解となるゲーム仕様は [公式ルール](../01-rulebook.md) と [カード仕様正本](../正本/カード仕様正本.md)。Godot の描画・音声再生・CPU 性能の合格をこの比較だけで主張しません。

## 保存された比較対象

現行基準は `godot-conformance-2026-10-03` です。既存の転生候補修正に合わせて、理論の化身・カオス召喚・転生の意志の出力と転生候補ベクトルを更新しました。211ケースの入力と706ステップの操作列は旧基準と一致し、専用のカード意味テストと仕様オラクルを通しています。以前の [比較基準](../test/fixtures/godot-conformance) は履歴として保持し、保存形式の互換テストでも引き続き検査します。

| ファイル | 内容 |
| --- | --- |
| [cases.json](../test/fixtures/godot-conformance-2026-10-03/cases.json) | 211 ケースの初期 `gameState` / `cardState` / `prngState` と具体的な操作列 |
| [expected.json](../test/fixtures/godot-conformance-2026-10-03/expected.json) | 706 ステップの全状態、全ルールイベント、受理結果、終局結果、補助ハッシュ |
| [vectors.json](../test/fixtures/godot-conformance-2026-10-03/vectors.json) | PRNG、復元、shuffle、合法手列挙、転生候補順、同値 marker 順、文字列化とハッシュの正解例 |
| [実行コード](../scripts/godot-conformance.ts) / [検証](../test/godot.conformance.test.ts) | 公開 `BattleMatch` を使う再生・比較・収録漏れ検査・仕様オラクル |

`card/<cardId>/basic` と `card/<cardId>/rejected` を全100種に保存しています。94種の有効カードに加え、派生専用の三連鎖・四連鎖・無限連鎖、三連投石・四連投石・無限投石も含みます。`enabled:false` のこの6種を「使えないカード」として移植から落としてはいけません。

基本ケースはカード使用、必要な全対象選択、追加配置、通常配置、次の所有者手番開始までを記録します。使用後に終局したケースは終局までです。使用条件があるカードには、数字マス獲得履歴・直前破壊履歴・盤上特殊石・経過手数を明示した初期局面を与えています。これは対局の途中局面であり、初期配布からその局面までの履歴を復元するケースではありません。初期局面の構築には既存の [production-card-fixtures](../scripts/production-card-fixtures.ts) を再利用しますが、比較時には保存済みの具体的な入力だけを再生します。将来CPUの候補選びが変わっても、比較入力は勝手に変わりません。

拒否ケースは各カードを「この手番ではカード使用済み」の状態で再使用します。全100件で拒否・カード維持・布石維持・盤面維持・乱数非消費を要求します。対象不成立など、すべての拒否理由を各カードごとに網羅したという意味ではありません。カード別の詳細条件は [ルール対応表](godot-port-rules.md) に挙げた既存の意味テストで補います。

| 必須の組合せ・境界 | ケースID | 仕様に基づく独立検査 |
| --- | --- | --- |
| 連続パス・満盤 | `boundary/consecutive-passes` | 満盤だけで終了せず、1回目のパスで未終了、2回目で黒64・白0の終局 |
| 不正配置・合法手がある時のパス | `boundary/illegal-placement` | 保存された拒否結果と完全状態を照合 |
| 対象選択の維持 | `boundary/reincarnation-invalid-target` | 転生先の対象が不適なら pending を維持し乱数を消費しない |
| 円外マス | `boundary/circle-exterior` | 円の外に通常配置できない |
| 幽体と破壊 | `interaction/destroy-ghost` | 破壊対象にできるが白の幽体石は残る |
| 四属性の融合 | `interaction/four-element-fusion` | 火・水・草・雷から森羅万象神が実際に成立 |
| 穴、穴の修復、盤の拡張・縮小 | `card/meteor_01/basic`, `card/causal_replay_01/basic`, `card/board_expand_01/basic`, `card/board_shrink_01/basic` | 盤面変更が起きることを要求し、座標・全marker・石ID・結果を照合 |
| 複数対象・自由配置・手札対象 | 各 `card/*/basic` | 固定された全操作列の成功、使用カードの消費、全中間状態を照合 |
| 時間停石・時間停神の発動と終了 | `lifecycle/time_stop_god_01/activation-to-handoff`, `lifecycle/time_stop_deity_01/activation-to-handoff` | 所有者開始で残2→1、相手開始では不減、残1→発動。通常石への復帰、発動手番を含む2/4連続手番、各完了時の残数、相手への交代、ラウンド進行を検査 |
| 屍石の感染 | `lifecycle/zombie_will_01/delayed-activation` | 相手開始では残1を保持、所有者開始で敵通常石1個を自色の屍石へ変更。両個体の感染カウント4・復活残1、新生個体の同開始内不発動を検査 |
| 時限爆弾の爆発 | `lifecycle/bomb_01/delayed-activation` | 相手開始では残1を保持、所有者開始で3×3内の無保護石9個と石ID・爆弾markerを除去。範囲外の生存と布石非獲得を検査 |
| 種の芽生え | `lifecycle/seed_01/delayed-activation` | 相手開始では残1を保持、所有者開始で通常石1個を生成して石IDを付与し、挟んだ相手石を反転。種markerの除去を検査 |

`assertCoverage` は現在のカード一覧から必要IDを検査します。カードを追加してfixtureを入れ忘れると失敗します。単に現在の実装出力を保存し直すだけでは合格しません。独立検査で、使用成功・消費・拒否時の不変性・各種本体/付与/マスmarkerの新規成立・パスによる終局・幽体の生存・pending維持・融合・穴の生成と修復・拡張座標を確認します。宝箱とリボ払いは初期布石を10にして上限による効果の隠蔽を防ぎ、獲得量とプロフィール倍率2を検査します。平等の意志の移送量は倍率を掛けず10、増援/援軍/救済の初回生成数は1/3/2を検査します。それ以上の効果固有の仕様は既存カードテストを併せて実行します。

遅延発動の5ケースは、2026-09-22の独立レビューで「基本ケースが次の所有者開始で終了し、主要効果の発動まで到達しない」と判明したため追加しました。時間停止処理 `consumeTimeStopConsecutiveTurn` を常に不成立に置き換えると、従来206ケース・671ステップは差分0で通過しました。追加後の回帰テストは、その置換が固定期待値比較と仕様に基づく独立検査の両方で失敗することを確認します。余分な連続手番・早すぎるラウンド進行、感染・爆発・芽生えの欠落も独立検査で拒否します。

追加した初期局面は意図的な発動直前の局面で、操作列は手書きの固定合法配置です。現実装から探索した操作列や無制限の対局延長には依存しません。時間停止の配置直後の残5と次所有者開始の残4は基本ケース、発動前の残2以降と終了後の通常交代は追加ケースに収録します。全5回を連続して追う検証は既存の時間停止専用テストで補います。屍石の追加ケースは周囲が埋まって移動先がなく、感染先が1個だけの局面です。移動後の感染・複数候補の乱数選択・感染不発・復活・保護との相互作用をすべてこのケースで網羅したとは扱いません。同様に、全カードの寿命末端・すべての効果の組合せは未網羅です。

カード仕様の変更に合わせ、`card/extend_life_01/basic`（延命の意志のコスト4→6）と `card/extend_life_god_01/basic`（延命神の倍率4倍→3倍）の期待値だけを現行仕様へ更新しました。入力 `cases.json`、`vectors.json`、他209ケースの期待値は変更していません。

水の意志の治癒マスが発動元以外の自分の特殊石本体のマスを優先する仕様変更に合わせ、`card/water_will_01/basic` と `interaction/four-element-fusion`（森羅万象神の水の意志相当の効果）の期待値だけを現行仕様へ更新しました。入力 `cases.json`、`vectors.json`、他の期待値は変更していません。

更新時は新規ディレクトリへ収録し、従来206ケースの入力・671ステップの出力と決定論vectorsが変更されていないことを照合しました。現在の採用基準へ5ケース35ステップを追加したもので、歴史的な保存・リプレイfixtureを更新したものではありません。

既存の内部production fixtureの数値石IDは、移植用入力を作る入口で公開形式 `sN` / 空欄 `null` に変換しています。旧fixture本体は変更していません。公開保存検証との照合も行い、内部でしか受け取れない局面を外部契約の正解例にしないようにしています。

## 実行とGodot側の出力

リポジトリの依存を導入して `npm run build:ts` を実行した後、次を使います。

```text
node dist/scripts/godot-conformance.js check
node dist/scripts/godot-conformance.js generate output/godot-current.json
node dist/scripts/godot-conformance.js compare output/godot-result.json
npm run test:jest -- --runTestsByPath test/godot.conformance.test.ts
```

`generate` は保存済み入力を現在の実装で再生して結果を書きます。既存ファイルを上書きしません。`check` は仕様検査・収録検査・全状態の固定golden比較・決定論vectorsを実行します。`compare` はGodot等が出力したJSONを固定goldenへ比較し、不一致時は終了コード1を返します。`record <新しいディレクトリ>` は意図的に新しい採用基準を作るための操作で、既存ディレクトリでは失敗します。新基準を採用する際は変更仕様・テスト根拠・旧基準の適用範囲をレビューし、歴史fixtureを置き換えてはいけません。

入力と結果はUTF-8のJSONです。トップレベルは `{ "schema": "godot-conformance.v1", "cases": [...] }`。入力caseは `id`, 任意の `cardId`, `tags`, `spec`, `initial`, `operations` を持ちます。操作は `{ "kind":"turn_start" }` または `{ "kind":"action", "action":{...} }`。`turn_start` は自動挿入せず、順番どおり1回ずつ実行します。

出力caseは `{ "id": "...", "steps": [...] }`。各stepは `kind`, `player`, `ok`, `reason`, `stopAction`, `events`, `state`, `stateHash`, `result` を持ちます。`reason` は成功時null、`stopAction` は未指定時false、`result` は未終局時nullです。`state` は操作後の `{gameState,cardState,prngState}`。`stateHash` はこの完全なstateに対する後述のハッシュです。入力actionはcases側に保存するため出力stepに重複して含めません。

比較はcase配列の順番に依存せずIDで対応させます。未知・欠落・重複case、欠落step、余分なcase内フィールド、配列順の違い、`null`と項目不在の違いを拒否します。オブジェクトのキー順だけは無視します。差分例は `caseId: card/reincarnation_will_01/basic`, `step: 1`, `path: /steps/1/state/cardState/markers/3/data/type`。step番号は0始まりです。1ケースあたり最大100差分、CLI表示は全体先頭100差分で打ち切りますが、不一致判定は打ち切りで成功に変わりません。

比較から任意フィールドを削除する設定はありません。公開 `BattleMatch` が遷移後に破棄する一時的なruntime参照3つ（`_defaultRandomSource`, `_boardOpsRandomSource`, `_currentActionMeta`）はそもそもJSONに存在せず、配信済みpresentation queueとcharge display deltaは公開境界で空になります。これは公開APIの契約です。`events` は返されたルールイベントの全件で、rendererのフレームや音声波形そのものは含みません。演出の時系列は [演出移植資料](godot-port-presentation-lifecycle.md) の証拠で別途確認します。

## 乱数、候補順、数値

正本の実装は [game/schema/prng.ts](../game/schema/prng.ts) です。初期値をuint32へ変換し、呼び出すたび `state = (1664525 * state + 1013904223) mod 2^32`、返値を `state / 4294967296` とします。`nextInt(max)` は `floor(random() * max)`、shuffleは末尾 `i=n-1` から1へ下がるFisher–Yatesで `j=floor(random()*(i+1))`。空または1要素のshuffleは0回、n要素ならn−1回消費します。

保存するcheckpointは内部の現在整数ではなく `{seed,calls}`。復元は初期seedからcalls回進め、次回はその次の値です。公的な保存契約ではseedは0..4294967295の整数、callsは0..10000000です。JSの負数からの暗黙uint32化を外部入力で再現する必要はなく、不正入力として拒否します。積は2^53未満なのでJS倍精度でも整数として厳密ですが、Godotでは64-bit整数で計算して `& 0xffffffff` するか、同じmoduloを明示してください。表示演出がcanonical PRNGを消費してはいけません。

候補は辞書の自然反復順へ任せません。通常の合法手は行、列の順、8方向は `[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]`。転生候補はカタログ順を維持した理論召喚候補から元の種類・罠・時限爆弾を除外します。候補配列を並べ替えると同じ乱数でも別結果になります。実際の候補はvectorsと各caseのpending/offersへ保存しています。

ターン開始個体の順序は `createdSeq` 昇順、同値なら入口でのcanonical marker配列上の `sourceIndex`、さらに同値ならmarkerIdの文字列比較です。vectorsでは同じcreatedSeqのmarkerId `b` が `a` より先なのはsourceIndexを優先するためです。入口で個体集合を固定し、座標・生存・所有者・対象候補は各個体の実行時に調べます。途中で新生した個体を同じ開始処理へ追加しません。CPU探索の同点選択はCPU資料の固定探索量比較で別に扱い、ゲーム効果の乱数選択と混ぜません。

## 状態ハッシュ

[shared/state-hash.ts](../shared/state-hash.ts) の `stableStringify` はオブジェクトキーをJavaScriptのUTF-16辞書順でソートし、配列順は保存、空白を入れずJSON文字列化します。数値はJS `String(number)` 相当で、`-0` は `0`。公開JSONにNaN、Infinity、undefined、関数は許しません。一般関数では非有限数はnull、objectのundefined値は省略されますが、これを保存入力の許可規則と取り違えてはいけません。

FNV-1aは初期値2166136261。文字列の各 **UTF-16 code unit** ごとにXORし、16777619を掛けて下位32-bitを保持します。UTF-8 bytesやUnicode code pointに対して計算する一般的なFNVライブラリとは異なります。`😀` は2つのcode unitになります。出力は `fnv1a32:` + 小文字16進8桁。vectorsは日本語・絵文字・改行・quote・backslash・キー順・数値を含みます。ハッシュ一致だけで合格にせず、比較では状態本体も必ず照合します。これは破損や差分の補助検出であり、署名や暗号学的な真正性保証ではありません。

歴史的な [battle-before-refactor.json](../test/fixtures/battle-before-refactor.json) / [battle-save-v1.json](../test/fixtures/battle-save-v1.json) は本比較で上書きしません。履歴の互換判定と現在の採用版goldenは別用途です。
