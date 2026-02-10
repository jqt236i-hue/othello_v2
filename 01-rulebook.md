# カードオセロ 公式ルールブック（統合版）

このファイル（`01-rulebook.md`）をルールの最優先一次情報として扱う。

- ゲーム共通ルール / カード仕様 / UI・演出仕様を 1 ファイルに統合している。

1. ゲーム概要

カードオセロは、8×8 盤の通常オセロ（リバーシ）に、カード（特殊効果）とチャージ（布石）を加えた 2 人対戦ゲームである。
勝敗は通常オセロと同様に 最終盤面の石数で決まる。

2. 用語・定義
2.1 盤面状態

各マスは以下のいずれか：

BLACK（黒）

WHITE（白）

EMPTY（空）

2.2 合法手（Legal Move）

通常時、プレイヤーが石を置ける手。以下を満たす必要がある：

置くマスが EMPTY である

置いた石から 8 方向（縦横斜め）のいずれかで
「相手石が 1 枚以上連続し、その先に自分石がある」
という 挟みが成立する

挟まれた相手石列が 反転対象となる。

2.3 反転（Flip）

盤面上の石の色が変わること。
本ゲームでは以下を すべて反転として扱う：

通常オセロの挟みによる色変更

カード効果による色変更（SWAP、ドラゴン効果など）

破壊（石が消える）は反転ではない。

2.4 破壊（Destroy）

石を取り除き、そのマスを EMPTY にすること。
破壊は反転ではないため、チャージ獲得に寄与しない。

2.5 パス（Pass）

自分の手番で合法手が 1 つも無い場合、プレイヤーは「カード使用」または「パス」を選べる。
カード使用後に合法手が増えれば配置できる。増えなければパスする。
パスは「手番が来た回数」としてカウントされる。
カード使用後にパスした場合、その時点で未解決のカード効果はすべて破棄され、次ターンへ持ち越さない（消費済みコスト/使用カードは戻らない）。

2.6 詰み（Stalemate）

両者が連続でパスした状態。
実際の進行としては「A がパス → B もパス」で発生する。

3. 盤・初期設定
3.1 盤サイズ

盤は 8×8

3.2 初期配置

中央 4 マスに 通常オセロと同じ配置で開始する

3.3 手番

黒（BLACK）が先手、白（WHITE）が後手を基本とする

4. デッキ・手札・ドロー
4.1 デッキ構成

デッキ初期枚数：30 枚

デッキは初期生成後にシャッフルされ、通常ドローで引くカード順は毎試合ランダムになる（ただし乱数seedが同一なら再現可能）。


デッキは **全カード種類を最低1枚ずつ保証** したうえで、合計30枚になるように構成する。

同一カード種が2枚以上含まれる場合がある（重複可）。

4.2 初期手札

各プレイヤー：0 枚（開始時ドローなし）

4.3 手札上限

手札は最大 5 枚

手札が 5 枚のとき、ドローは発生しない（そのドロー機会は失われる）

4.4 ドロー頻度（確定）

各プレイヤーは 自分の手番が訪れるたびに 1 枚ドローする

例：1回目＝1枚、2回目＝1枚、3回目＝1枚…

パスも手番として数える

DOUBLE_PLACE（2回配置）でも手番は 1 回として数える

4.5 山札枯渇時

山札が無くなった場合、再シャッフルは行わない。

この場合のドローは失敗し、手札は変化しない。

5. チャージ（布石）
5.1 範囲

チャージは 0〜30

上限を超える加算は 30 に丸める

5.2 獲得条件（確定）

5.2.1 チャージ加算の対象とタイミング（確定）

反転（Flip）で色が変わった枚数は、その反転を発生させた側（効果の所有者）のチャージに加算する。
加算タイミングは、その反転が発生した処理の時点で直ちに行う（ターン開始時の継続効果による反転も同様）。


1 ターンで発生した 反転枚数の合計だけチャージを得る

通常反転：対象

カード反転（色変更）：対象

破壊：対象外

反転 0 なら獲得 0

5.3 消費

カード使用には チャージを消費する

チャージが不足する場合、そのカードは使用できない

6. 保護状態（Protected / PermaProtected）
6.1 Protected（短期保護）

Protected が付与された石は次の性質を持つ：

反転不可（通常反転・カード反転のいずれでも色が変わらない）

交換不可（SWAP 等の変換効果を受けない）

破壊は可能

持続：1 ターン

「相手のターンが 1 回終わったら」解除され通常石に戻る

6.2 PermaProtected（永久保護）

PermaProtected は Protected の永続版：

反転不可

交換不可

破壊は可能

解除されない（破壊されるまで継続）

6.3 保護石が絡む合法手判定（確定・最重要）

保護石は反転しない

よって、合法手判定における「反転列」に 保護石を含めない

その結果：

反転列の途中に保護石が存在する方向は、反転列として成立しない

通常時、その方向だけでは合法手にならない

7. ターン進行（処理順序：固定）

各手番は次の順で進む。順序は変更しない。

ターン開始処理（継続効果などがある場合）

ドロー判定（自分の手番ごと）

カード使用（任意）

使用可能なのは 石を置く前のみ

1 ターン 最大 1 枚

チャージをコストとして消費

行動

通常：合法手から 1 マス選んで配置

合法手が無い：カード使用（任意）またはパスを選択

カード使用後も合法手が無い：パス
（このとき未解決のカード効果は破棄し、次ターンへ持ち越さない）

FREE_PLACEMENT 中：空きマスなら任意配置可（反転 0 も可）

反転処理（挟み・カードによる色変更を適用）

配置後処理

爆弾、ドラゴン等の処理（発動条件に従う）

チャージ加算

このターンに起きた反転枚数を合計し加算（上限 30）

終了判定（6.1 参照）

手番交代

7.1 ターン開始処理の順番（確定）

ターン開始時に発動する継続効果（時限爆弾、究極反転龍、繁殖、究極破壊神、多動石など）が複数ある場合、以下の順で処理する。

（注）ターン開始処理には、ドロー判定や期限切れ処理、出稼ぎ（WORK_WILL）の収入などの内部処理も含まれる。これらはマーカー処理より先に行う。

- 「爆弾」および「特殊石」を同一の対象として扱う。
- 各マーカーには作成順を表す `createdSeq` があるものとして、`createdSeq` の昇順で 1 件ずつ処理する（=作成順）。
- `createdSeq` が同値または未設定の場合の優先順位は規定しない（実装上の並び順に従う）。
- ターン開始処理の途中で新たに生成されたマーカーは、そのターン開始処理では発動しない（次回以降のターン開始時に評価する）。


8. DOUBLE_PLACE（連続2回配置）

DOUBLE_PLACE が有効なターンは、1 ターンに最大 2 回配置できる。

8.1 基本仕様（確定）

ドロー判定は 1 回のみ（ターン開始時）

2 回目も 合法手のみ

1 回目の配置後に「勝敗が確定する状態」が成立した場合、2 回目は行わない

チャージは 2 回分の反転合計で計算する

8.2 手順

1回目の配置（通常ルール）

反転・配置後処理を適用

終了条件成立なら 2回目なし → ターン終端へ

2回目の配置（合法手のみ）

反転・配置後処理

ターン終端（チャージ→終了判定）

9. 終了条件と勝敗（確定）
9.1 終了判定タイミング（確定）

終了判定は「配置・反転・カード/爆弾/ドラゴン等の処理をすべて適用した後」に行う。
ターン途中では終了しない。

9.2 終了条件

以下のいずれかでゲーム終了：

盤面が埋まる（EMPTY が 0）

詰み：両者が連続でパスした

9.3 勝敗決定

終了時点の盤面で黒石数と白石数を数える

多い方が勝ち、同数は引き分け

10. カード効果（確定仕様）

カードのチャージコストや所持枚数はカード定義に従う。本節は効果処理のルールのみを定義する。

10.1 FREE_PLACEMENT

次の配置は 空きマスなら任意

反転できなくても置ける（反転 0 可）

10.2 PROTECTED_NEXT_STONE

次に置く自分の石に Protected（短期保護） を付与する

10.3 PERMA_PROTECT_NEXT_STONE

次に置く自分の石に PermaProtected（永久保護） を付与する

10.4 SWAP_WITH_ENEMY

相手の通常石 1 枚を自分色に変換（反転扱いでチャージ対象）

- 使用条件：盤面に「相手の通常石」が 1 つ以上存在すること（存在しない場合は使用不可）
- 対象は相手の通常石のみ（特殊石・爆弾石は対象外）
- Protected / PermaProtected は交換不可のため対象外

10.5 DESTROY_ONE_STONE

任意の石 1 枚を破壊（EMPTY化）

Protected / PermaProtected でも破壊可能

破壊は反転ではないためチャージ対象外

10.6 TIME_BOMB

所有者のターン開始時にカウントを 1 減らし、0 になったら即爆発

3ターン後に 3×3 範囲で爆発

爆発は 石を破壊するだけ

爆弾石は 交換不可（Protected / PermaProtected と同様）。ただし破壊は可能。反転された場合、爆弾効果は解除され通常石になる


破壊なのでチャージ対象外

Protected / PermaProtected でも破壊可能

10.7 GOLD_STONE

配置時の反転は通常通り発生する

置いた石は **配置直後に破壊扱い** となり、500ms の透明度フェードアウトで消滅して EMPTY に戻る（同一ターン内で完結。次ターンまでマーカーを残さない）

そのターンに獲得するチャージ（反転枚数合計）を 4倍にする

上限 30 は最終適用

10.7.1 SILVER_STONE（銀の意志）

配置時の反転は通常通り発生する

置いた石は **配置直後に破壊扱い** となり、500ms の透明度フェードアウトで消滅して EMPTY に戻る（同一ターン内で完結。次ターンまでマーカーを残さない）

そのターンに獲得するチャージ（反転枚数合計）を 3倍にする

上限 30 は最終適用

石の外見（黒白共通）：`assets/images/stones/silver.stone.png`

10.8 PLUNDER_WILL（吸収の意志）

このターンに発生した反転枚数を k とする

相手のチャージから min(k, 相手チャージ) を減らし、その分を自分に加算

上限 30 は最終適用

10.9 STEAL_CARD（略奪の意志）

このターンに発生した反転枚数だけ相手のカードを奪う

奪取数 = min(反転枚数, 相手の手札枚数)

相手の手札の左から順に奪う（奪われたカードは相手手札から除去される）

奪ったカードのうち、手札上限 5 に収まる分は自分の手札末尾に追加する

手札上限で受け取れない超過分は破棄せず、自分のデッキに加える

反転0の場合は何も奪えない（チャージのみ消費）

10.10 ULTIMATE_REVERSE_DRAGON（究極反転龍）

次に置く石を龍化し、配置したターンに即時、周囲8マスの相手石を自分色に変換する。以降も所有者のターン開始時に発動する

持続：**5ターン（所有者のターン開始時に最大5回発動）**
※配置ターンに1回即時発動するため、合計の発動回数は最大6回

処理順：通常の反転（挿み） → 究極反転龍の追加反転

効果：**配置したターンの即時**、および **所有者のターン開始時**に、ドラゴンのアンカーの周囲8マスを自分色に変換する

- **アンカー（dragonAnchor）**：このカード使用後にプレイヤーが行う「次の石配置」で置かれた石の座標をアンカーとして登録する（カード使用だけでは盤面は変化しない）
- **アンカー石の耐性**：ドラゴン持続中、アンカー石は **反転不可・交換不可（Protected相当）**。ただし **破壊は可能**
- **周囲の定義**：アンカーを中心とした **8近傍（3×3 の中心以外）**。盤外は無視する
- **変換ルール**：周囲8マスの **相手石** かつ **Protected / PermaProtected でない**石を **自分色に変換**（色変更＝反転）。EMPTY / 自分石は変化なし
- **チャージ（布石）**：色が変わった枚数は **反転枚数としてカウント**し、そのターンのチャージ獲得対象
- **ターンカウント**：所有者のターン開始時に残り回数を 1 減らし、その値が 0 以上なら効果を発動する（0 の時も発動する）。効果適用後、残り回数が 0 の場合は消滅
- **消滅**：アンカー座標を **EMPTY にする（破壊扱い）**。破壊は反転ではないため、消滅によるチャージ加算は発生しない
- **アンカー消失時**：ターン開始時点でアンカー座標に「所有者の石」が存在しない場合（破壊された等）、効果は即終了する

10.11 BREEDING_WILL（繁殖の意志）

次に置く石を儀式石（アンカー）にする

持続：**3ターン（所有者のターン開始時に最大3回発動）**
※配置ターンに1回即時生成するため、合計の生成回数は最大4回

処理順：通常の反転（配置による挿み） → 石生成 →（生成石による反転）

効果：**配置したターンの即時**、および **所有者のターン開始時**に、儀式石の周囲8マスから空きマスを **ランダムに1マス** 選び、石を1個生成する（空きがない場合は生成しない）

- **反転**：生成した石で挿める相手石がある場合は通常の反転を行う
  - 反転枚数はチャージ対象
- **ターンカウント**：所有者のターン開始時に残り回数を 1 減らし、その値が 0 以上なら生成する（0 の時も生成する）。生成後、残り回数が 0 の場合は効果終了
- **効果終了**：最終回の生成後、儀式石は破壊される
  - 最後のターンは「石生成 → 儀式石破壊」の順で処理する
- **アンカー消失時**：ターン開始時点でアンカー座標に「所有者の石」が存在しない場合、効果は即終了する

- **繁殖石の耐性**：持続中、**繁殖石は反転不可・交換不可（Protected 相当）**。ただし **破壊は可能**（つまり、繁殖石は通常の反転や SWAP 等の変換効果の対象外）。


10.12 ULTIMATE_DESTROY_GOD（究極破壊神）

次に置く石を究極破壊神（UDG）にする

持続：**3ターン（所有者のターン開始時に最大3回発動）**
※配置ターンに1回即時発動するため、合計の発動回数は最大4回

**注**：配置ターンの即時発動は `remainingOwnerTurns` を消費しません。配置時の即時発動は置いた直後のボーナスとして扱い、以後の「所有者のターン開始時に行う最大3回」とは別扱いです。

効果：**配置したターンの即時**、および **所有者のターン開始時**に、UDG が盤上にあるなら周囲8マスの **敵色の石** をすべて破壊する（Destroy）

- **UDG石の耐性**：持続中、UDG は **反転不可・交換不可（Protected相当）**。ただし **破壊は可能**
- **破壊の扱い**：破壊神/時限爆弾と同じ Destroy（EMPTY化）として扱う（破壊はチャージ対象外）
- **処理順（固定）**：
  1) 周囲8マスの敵石を Destroy
  2) remainingTurns -= 1
  3) remainingTurns == 0 なら UDG 自身を Destroy（EMPTY化）
- **アンカー消失時**：ターン開始時点でアンカー座標に「所有者の石」が存在しない場合、効果は即終了する

10.13 HYPERACTIVE_WILL（多動の意志）

次に置く石を多動石にする

効果：多動石は **両者のターン開始時** に、周囲8マスの空きマスへ **ランダムに1マス移動** する

処理順（配置ターン）：
配置したターンには移動しない（ターン開始時のみ発動）。


処理順（ターン開始時）：
ターン開始 →（ターン開始時の継続効果を作成順に処理。7.1参照）※この作成順処理に多動石の移動を含める →（移動後に反転が起きれば通常反転）→ 以降の通常ターン処理

- **移動先の決定**：周囲8マスの EMPTY のみが候補。候補が1つ以上あればランダムに1マス移動。候補が0ならその場で消滅（Destroy）
- **移動の扱い**：移動そのものは反転ではないためチャージ対象外
- **移動後の反転**：移動先から通常ルールで挟める場合は反転を行い、その反転はチャージ対象
- **属性解除**：多動石が反転または交換された時点で多動属性は解除され、通常石に戻る
- **複数処理順**：複数の多動石がある場合、付与順（作成順 / `createdSeq` の昇順）で処理する


10.19 WORK_WILL（出稼ぎの意志）

次の配置をアンカーにする（カード使用→次の配置でアンカー登録）。
アンカーの石が盤上にあり、かつ所有者の石である限り、所有者は自分のターン開始時に 1,2,4,8,16 の順でチャージを得る。

- 各ターン開始時の加算後、チャージは最大 30 に丸める。
- アンカー石が反転/支配/交換などで相手の石になった、または破壊されて EMPTY になった場合、効果は即終了する（以後加算しない）。
- 同じ所有者が複数の出稼ぎアンカーを持つことはできない（新しいアンカーが置かれた場合、古いアンカーは終了する）。

10.20 SACRIFICE_WILL（生贄の意志）

盤面上の自分の石を選んで破壊し、布石を獲得する（選択型カード）

- 対象は **自分色の石のみ**（通常石・特殊石どちらも可）
- 1回の選択で対象1つを破壊し、使用者は **布石+5** を得る（上限30）
- 選択は **最大3回** まで行える
- 1回以上選択後は、任意のタイミングで選択を終了できる（終了時に返金はない）
- 対象がなくなった場合は自動終了

10.21 SELL_CARD_WILL（売却の意志）

カード使用後、手札からカード1枚を売却する（手札選択型カード）

- コスト: 8
- 対象は **自分の手札のカードならどれでも可**
- 売却時、売却したカードのコスト分だけ布石を獲得する（上限30）
- 売却回数は1回固定（0回終了は不可）
- 売却対象が1枚もない場合、このカードは使用不可

10.22 CROSS_BOMB（十字爆弾）

次に置く石を十字爆弾石にする

- 処理順：**通常反転（配置による挟み）→ 十字爆発**
- 爆発範囲：配置マス（中心）と、上下左右1マス（十字5マス）
- 範囲内の石は **色・種類・保護状態を問わず** 破壊される（自分石/相手石どちらも対象）
- 中心の十字爆弾石自身も破壊される
- 範囲内の空きマスは何もしない
- 破壊は誘爆しない（ただ消える）
- 破壊によるチャージ獲得はない
- 演出は同時再生ではなく、**反転演出の後に爆発演出**を再生する

10.23 STRONG_WIND_WILL（強風の意志）

盤面上の石を1つ選び、強風で一直線に飛ばす（選択型カード）

- コスト: 9
- 対象は **盤面上の任意の石**（自分/相手/通常/特殊を問わない）
- ただし、上下左右のいずれにも1マスも進めない石（隣接4方向すべてが盤外または石）は選択不可
- 選択後、進める方向（上下左右）からランダムで1方向を選ぶ
- その方向へ直進し、停止位置は次の通り
  - 盤面端まで空いていれば端マス
  - 途中に石があれば、その直前の空きマス
- 移動は反転ではない（チャージ加算なし）
- 追加破壊・追加反転は発生しない
- 演出は多動石の直線移動アニメーションを流用する

10.24 HEAVEN_BLESSING（天の恵み）

候補カードから1枚を選んで獲得する（手札選択型カード）

- コスト: 3
- 使用時、全カードプールからランダムに最大5枚を候補として提示する
  - 候補は重複なし
  - このカード自身（天の恵み）は候補に含めない
- 候補から1枚を選ぶと、そのカードを自分の手札に加える
- 選ばれなかった候補は捨て札に行かず消滅する
- 手札上限（5枚）に達している場合は選択不可
- 候補を生成できない場合（候補0枚）はこのカードは使用不可

10.25 CONDEMN_WILL（断罪の意志）

相手の手札を見て1枚を選び、破壊する（手札選択型カード）

- コスト: 6
- 使用条件：相手手札が1枚以上あること（0枚なら使用不可）
- 相手手札を公開し、1枚を選んで破壊する
- 破壊したカードは捨て札に送られる
- 破壊回数は1回固定（0回終了は不可）

10.26 TRAP_WILL（罠の意志）

盤面上の自分の石を1つ選び、罠石にする（選択型カード）

- コスト: 14
- 使用時、罠の設置自体は公開するが、罠の座標は非公開とする
- 設置者本人は罠石の座標を常に確認できる
- 罠石は「次の相手ターンのみ」有効
- 相手ターン中に相手がその罠石を反転した場合、即時に発動する
- 発動時:
  - 相手の布石を 0 にし、その値を自分に加算する（上限30）
  - 相手手札を左から最大3枚没収する
  - 没収したカードのうち手札上限5を超える分は破棄せず自分デッキ末尾へ加える
- 相手ターン中に反転されなかった場合、罠石は不発で消滅する
- 罠石が破壊された場合、罠は不発で終了する（発動しない）

10.27 GUARD_WILL（守る意志）

盤面上の自分の石を1つ選び、完全保護を付与する（選択型カード）

- コスト: 7
- 対象は **自分の石のみ**（通常石・特殊石どちらも可）
- 付与中は **反転無効 / 交換無効 / 破壊無効**
- 付与中は **誘惑（TEMPT_WILL）も無効**
- 持続は **3ターン**（所有者のターン開始時に 3→2→1→0 と減少し、0で解除）
- UI表示:
  - シールド残りターンは **石の中央上** に表示
  - タイマー枠自体をシールド形（五角形）で表現する

10.28 TREASURE_BOX（宝箱）

使用時に布石をランダム獲得する（即時発動カード）

- コスト: 0
- 使用時、布石を **1 / 2 / 3** のいずれかからランダムで獲得する
- 加算は即時に行い、上限は30
- 選択操作は不要（対象選択なし）

10.14 INHERIT_WILL（意志の継承）

盤面上の自分の通常石を1つ選び、強い意志（PERMA_PROTECTED）状態にする

- 対象は自分色の通常石のみ（特殊石・硬い意志・強い意志・時限爆弾は選択不可）
- 付与後の石は強い意志と同一扱い（反転不可・交換不可、破壊は可能）
- 見た目は強い意志と同一


10.15 CHAIN_WILL（連鎖の意志）

このターンの配置で発生した通常挟み反転（一次反転）を起点に、追加反転を最大1方向のみ行う

- 一次反転のうち自分色になった石を候補点とする
- 各候補点から8方向を評価し、追加反転できる相手石列が成立した方向を候補とする
- score はその方向の反転枚数
- 最大 score が複数ある場合は一様ランダムで1つ選ぶ（再現可能乱数）
- 選ばれた1方向のみ反転する（再帰しない）
- 保護石（Protected/PermaProtected）や爆弾が列中にある方向は不成立


10.17 REGEN_WILL（復活の意志）

次に置いた石が「再生石」になる（regenRemaining=1, ownerColorを保持）。
再生石が反転され相手色になった場合、即座に1回だけ元の色に戻る（戻り反転）。戻った結果、そのマスを起点に挟める列があれば、成立する方向の石を通常反転する（起点は再生石のマスのみ・盤面全体の再探索はしない）。Destroyでは発火しない。戻り反転自体はチャージ加算に含めず、再生後の挟み反転は通常反転としてチャージ計上する。

10.18 TEMPT_WILL（誘惑の意志）

盤面上の **相手の特殊石** を1つ選び、自分の石にする（支配権奪取）

使用条件：盤面に「相手の特殊石」が1つ以上存在すること（存在しない場合は使用不可）

特殊石の定義：盤面上で「通常石以外の見た目」の石（例：強い意志/弱い意志/多動の意志/究極反転龍/究極破壊神/繁殖の意志/金の意志/銀の意志/時限爆弾/意志の継承で変化した石/誘惑の意志で奪った石 など）

効果：
- 盤面上の相手の特殊石を1つ選ぶ
- その石を自分の石にする（色変更 + 所有者の更新）
- 付帯状態は保持する（残りターン/カウント/残量などのリセットはしない）
- この色変更は **反転（Flip）として扱わない**（チャージ計算に加算しない）

10.16 カードコスト（参考）

この節は **参考** であり、カードごとのチャージコストの一次情報は `cards/catalog.json` とする。
実装・テスト・本表が食い違う場合は、まず `cards/catalog.json` を正として扱い、本表とルール本文を更新する。

カードUIのコスト色分け:
- cost 0: 白
- cost 1〜5: 灰
- cost 6〜10: 緑
- cost 11〜15: 青
- cost 16〜20: 紫
- cost 21以上: 金

各カード（高い順）：

- cost 30
  - `udr_01` — **究極反転龍** (`ULTIMATE_REVERSE_DRAGON`) — 枚数: 1

- cost 27
  - `double_01` — **二連投石** (`DOUBLE_PLACE`) — 枚数: 1

- cost 25
  - `udg_01` — **究極破壊神** (`ULTIMATE_DESTROY_GOD`) — 枚数: 1

- cost 22
  - `chain_01` — **連鎖の意志** (`CHAIN_WILL`) — 枚数: 1

- cost 20
  - `tempt_01` — **誘惑の意志** (`TEMPT_WILL`) — 枚数: 1

- cost 18
  - `cross_bomb_01` — **十字爆弾** (`CROSS_BOMB`) — 枚数: 1

- cost 16
  - `breeding_01` — **繁殖の意志** (`BREEDING_WILL`) — 枚数: 1

- cost 15
  - `regen_01` — **復活の意志** (`REGEN_WILL`) — 枚数: 1

- cost 14
  - `trap_01` — **罠の意志** (`TRAP_WILL`) — 枚数: 1

- cost 13
  - `bomb_01` — **時限爆弾** (`TIME_BOMB`) — 枚数: 1

- cost 12
  - `perma_01` — **強い意志** (`PERMA_PROTECT_NEXT_STONE`) — 枚数: 1
  - `inherit_01` — **意志の継承** (`INHERIT_WILL`) — 枚数: 1

- cost 11
  - `work_01` — **出稼ぎの意志** (`WORK_WILL`) — 枚数: 1

- cost 10
  - `destroy_01` — **破壊神** (`DESTROY_ONE_STONE`) — 枚数: 1

- cost 9
  - `strong_wind_01` — **強風の意志** (`STRONG_WIND_WILL`) — 枚数: 1

- cost 8
  - `sell_01` — **売却の意志** (`SELL_CARD_WILL`) — 枚数: 1
  - `hyperactive_01` — **多動の意志** (`HYPERACTIVE_WILL`) — 枚数: 1

- cost 7
  - `steal_card_01` — **略奪の意志** (`STEAL_CARD`) — 枚数: 1
  - `guard_01` — **守る意志** (`GUARD_WILL`) — 枚数: 1

- cost 6
  - `condemn_01` — **断罪の意志** (`CONDEMN_WILL`) — 枚数: 1
  - `gold_stone` — **金の意志** (`GOLD_STONE`) — 枚数: 1

- cost 5
  - `sacrifice_01` — **生贄の意志** (`SACRIFICE_WILL`) — 枚数: 1
  - `swap_01` — **交換の意志** (`SWAP_WITH_ENEMY`) — 枚数: 1

- cost 4
  - `plunder_will` — **吸収の意志** (`PLUNDER_WILL`) — 枚数: 1

- cost 3
  - `heaven_01` — **天の恵み** (`HEAVEN_BLESSING`) — 枚数: 1
  - `silver_stone` — **銀の意志** (`SILVER_STONE`) — 枚数: 1

- cost 2
  - `free_01` — **自由の意志** (`FREE_PLACEMENT`) — 枚数: 1

- cost 1
  - `hard_01` — **弱い意志** (`PROTECTED_NEXT_STONE`) — 枚数: 1

- cost 0
  - `chest_01` — **宝箱** (`TREASURE_BOX`) — 枚数: 1

合計枚数（カード種類）：29種類

---

※注意: 旧ドキュメントやコードコメントではデッキ枚数に差分（20枚、24枚等）が見られます。カード構成・コストを変更する場合は、`cards/catalog.json`（一次情報）と `shared-constants.js`、テスト、および `inconsistencies_report.md` を合わせて修正してください。






---

# 03-visual-rulebook.v2 — Visual / UI / Animation Spec (Authoritative for visuals)
Last updated: 2026-01-21

This file defines the ONLY correct browser visuals (UI/animation), separately from game rules.
Game rules MUST stay in `01-rulebook.md`. This document only specifies how to PRESENT rule-engine facts.

Language note: This spec is intentionally mostly ASCII/English for tooling stability on Windows.
(You may translate to Japanese later without changing meaning.)

---

## 0) Scope / Non-scope

In scope:
- How events (place/flip/destroy/spawn/move/status/hand) are visualized and ordered.
- How special-stone visuals (PNG overlays, timers) are applied/removed.
- UI highlight behavior (legal moves, selectable targets).
- Timing constants (ms) for consistent playback.

Out of scope:
- Game legality, card effects, charge math, randomness resolution (see `01-rulebook.md`).

---

## 1) Canonical Contract (must follow)

### 1.1 Source of Truth
- The rule engine emits an ordered list of facts: `events[]`.
- UI MUST replay `events[]` in-order. UI MUST NOT infer missing flips/destroys by diffing state.
- If an event type is not recognized by UI, UI must still stay correct:
  - Apply its final visual state immediately (no animation), then continue.

### 1.2 Single Visual Writer
- During playback, exactly ONE module is allowed to mutate board DOM (the Playback Engine).
- Full-board rerender is forbidden while playback is running (it breaks ordering and causes double-apply).

### 1.3 Fixed Geometry
- During fade-in/fade-out/move/overlay/cross-fade, the disc’s position and size MUST NOT change
  unless explicitly specified by the event type.
- Overlay MUST match base disc size exactly (recommended: 82% width/height, centered).
- No "grow while fading". (This is a frequent bug source.)

### 1.4 Unified Flip ("Spec B")
- Flip visuals are unified across the whole game:
  - At flip start: swap color + special visuals immediately.
  - Then: play flip motion.
- This applies to normal Othello flips and card-induced flips.
- The same flip animation MUST be used everywhere.

### 1.5 True Cross-Fade (visual state change without motion)
For ownership/icon changes that are NOT intended to look like a physical flip (Tempt, Inherit, Regen, etc):
- Do NOT hide the disc.
- Fade in a temporary overlay (clone) with the new state over the old state.
- Old state parts may be masked only while overlay opacity is high.
- Goal: zero "empty frames" and zero double-motion.

### 1.6 Placement shows final look immediately
- When a special stone is placed, its final PNG look MUST be visible immediately.
- Optional appear animation is allowed, but no delayed PNG swap.
- All special stones MUST use the same drop-shadow rule as other stones (no stone-specific shadow disable).

---

## 2) Event Model (UI-facing; required fields)

The engine and UI must agree on a stable event shape. Minimal required fields:

- event.type: one of:
  - place, flip, destroy, spawn, move, status_applied, status_removed, hand_add, hand_remove, log
- event.phase: a monotonically increasing integer (or string key) for sequencing.
  - UI MUST process phase in ascending order.
  - If phase is absent, UI treats each event as its own phase.
- event.batchKey (optional): events with same (phase, type, batchKey) may animate concurrently.
- event.targets: list of affected cells or objects.
  - Board cell target: { r, c }
  - Move target: { from:{r,c}, to:{r,c} }
- event.after (required for board-affecting events): final visual state for the affected cell(s).
  - after.color: black/white/empty
  - after.special: enum or null (gold/silver/bomb/dragon/protect/...); includes timer if applicable
  - after.timer (optional): integer remaining turns to show

Notes:
- The rule engine must resolve randomness (if any) and emit concrete targets.
  UI must never roll randomness.

---

## 3) Timing Constants (ms) — MUST be centralized (single source)

- FLIP_MS = 600
- PHASE_GAP_MS = 200                 (gap between readable phases)
- TURN_TRANSITION_GAP_MS = 200       (gap between "placement resolution" and next turn-start effects)
- FADE_IN_MS = 300                   (spawn / appear)
- FADE_OUT_MS = 500                  (destroy / disappear)
- OVERLAY_CROSSFADE_MS = 600         (true cross-fade duration)
- MOVE_MS = 300                      (default straight-line move)

---

## 4) Playback Rules (normative)

### 4.1 High-level algorithm
1) Lock input (including CPU auto-step) while playback is running.
2) Group events by `phase` (ascending).
3) For each phase:
   - Further group by (type, batchKey). Each group runs concurrently.
   - Wait all groups, then wait PHASE_GAP_MS (unless phase explicitly says no gap).
4) Unlock input.

### 4.2 Correctness boundary
- The board DOM must represent the correct final state AFTER each phase completes.
- A final "state sync" is allowed only after playback ends (as a safety net),
  but MUST NOT run mid-playback.

### 4.3 Cancellation / fast-forward
- If the user triggers "skip animation" or a new game starts, playback must:
  - cancel pending timers,
  - apply final states immediately,
  - leave DOM consistent with the latest engine state.

---

## 5) Visual Primitives (event type -> visuals)

### 5.1 place
- Visual: disc appears already with final color and final special visuals.
- Animation: optional fade-in (FADE_IN_MS). No delayed PNG swap.

### 5.2 flip (Spec B)
- At flip start apply final:
  - disc color class
  - special overlay add/remove
  - timer UI (if any)
- Then: apply `.flip` motion (FLIP_MS).

### 5.3 destroy (to EMPTY)
- Visual: fade out disc (FADE_OUT_MS), fixed geometry.
- After fade: remove disc DOM (or mark invisible) and show empty cell.

### 5.4 spawn
- Visual: fade in disc (FADE_IN_MS), fixed geometry.
- Spawned disc is already final color and final special visuals.

### 5.5 move
- Visual: straight-line interpolation from (from) to (to).
- One move event == one straight path. No detours.
- Move does NOT imply flip. Any flips must be separate flip events in a later phase.

### 5.6 status_applied / status_removed (overlay-only change)
- Visual: true cross-fade between old and new overlay state (OVERLAY_CROSSFADE_MS).
- If coupled with a flip, flip rules dominate (Spec B); do not double-animate.

### 5.7 hand_add / hand_remove
- Visual: single fade-in/out for the card UI.
- No double-appearance.

### 5.8 log
- Visual: append log line immediately (no animation requirement).

### 5.9 effect log（効果ログ）
- 通常ログとは別に、効果ログ欄を持つ。
- 効果ログには「実際に発動した効果」だけを表示する（ターン開始/ドロー/カード使用そのもの等は表示しない）。
- 表示はスクロール履歴ではなく、最新表示を更新する方式（固定行数）とする。
- 位置は既定位置から右に 1cm、下に 1cm 移動し、大きさは 110% とする。
- 最新行は通常の濃さで表示し、他の行は薄く表示する。
- 効果ログの文言は日本語で統一する。
- 効果ログの各行は、必ず `黒:` / `白:` の発動者プレフィックスを付ける。
- 通常ログ側にはカード効果の文言を表示しない（重複表示を防ぐ）。
- ゲームリセット時（新規ゲーム開始を含む）に効果ログはクリアする。

### 5.10 normal log（通常ログ）
- 通常ログには進行情報を表示する（ゲーム開始、ターン開始、ドロー、パスなど）。
- 配置で反転が発生した場合、`黒がX枚反転！` / `白がX枚反転！` の要約を表示する。
- カード使用ログ（`黒/白がカードを使用: ...`）は AUTO/手動で共通の条件で表示する。
- 内部向け文言（例: `no animation`, `PresentationEvent: ...`）は表示しない。


### 5.11 charge delta (charge UI)
- When a player's charge value changes, show a delta label next to that player's charge display immediately.
- Black: left of its charge display. White: right of its charge display.
- Text: `布石+N` / `布石-N`.
- Increase color: blue-tinted. Decrease color: red-tinted.
- Entrance motion: appear from 1cm below and slide upward into place.
- Timing: keep visible for 4s, then fade out over 0.5s.
- New changes overwrite the current label and restart timing.

---

## 6) UI Highlights (global)

- Normal legal moves and FREE_PLACEMENT legal moves use the same styling.
- Target selection highlights:
  - Use CELL background only (do not alter the disc appearance).
  - Unselectable cells must not highlight.
- When highlighting is active, it must not conflict with animation classes.

---

## 7) Card-specific Visual Rules (exceptions only)

If a card is not listed here, it MUST follow Sections 1–6 with no special casing.

### 7.1 CHAIN_WILL
- Must look like:
  - primary flips (batch) -> gap -> chain flips (batch).
- Chain flips must not appear already color-changed before their flip motion starts.
  (Spec B must still be respected per disc; avoid early "state apply" for the whole phase.)

### 7.2 REGEN_WILL
When regen triggers immediately after being threatened:
1) Skip the enemy-color flip motion entirely.
2) Perform true cross-fade from threatened state to regenerated state (owner color + icon).
3) If regen-capture flips happen, they occur AFTER the cross-fade finishes (separate phase).
4) After regen is consumed, remove the icon via cross-fade (no snap).

### 7.3 TIME_BOMB
Explosion:
1) Bomb stone fades out first.
2) Then surrounding destroyed stones fade out as a batch.

Flip clears bomb:
- If a bomb is flipped, it becomes a normal stone immediately (bomb overlay removed).

### 7.4 DOUBLE_PLACE
- Two placements in one turn:
  - First placement completes fully (place -> flips -> post effects).
  - Gap (PHASE_GAP_MS), then second placement starts.
- Do NOT replay turn-start effects between the two placements.

### 7.5 TRAP_WILL
- 罠石は設置者には専用見た目で表示し、相手には通常石として表示する（秘匿）。
- 相手ターンで不発終了する場合、消滅直前に罠見た目へ切り替えてから既存の destroy-fade で消す。
- 効果ログには座標を出さず、設置時に `罠石がどこかに潜んでいる...` を表示する。
- 罠石の画像は `assets/images/stones/trap_stone-black.png` / `assets/images/stones/trap_stone-white.png` を使用する。

### 7.5 HYPERACTIVE_WILL
Placement turn: no hyperactive move.
Turn-start move:
- Moves are processed in engine-defined order; each move is still a single straight-line animation.
Readability:
- If a move happens, insert TURN_TRANSITION_GAP_MS before the next player's turn-start effects,
  so it does not look like one merged multi-square move.

### 7.6 TEMPT_WILL
- Ownership/color change is handled via true cross-fade (OVERLAY_CROSSFADE_MS).
- Do NOT use flip visuals unless it is a standard capture flip defined by Othello rules.

### 7.7 INHERIT_WILL / PROTECT variants
- Applying/removing protection overlays uses true cross-fade, fixed geometry.
- Countdown timers use the unified timer style across all timed stones.

---

## 8) Acceptance Checklist (must pass)

- Special stones show their PNG look immediately when placed.
- Flip is always "swap visuals first, then flip motion" (Spec B).
- Primary vs secondary phases (CHAIN/REGEN/move-then-flip/etc) are visually separable and ordered.
- Destroy/spawn fades do not change disc size/position.
- TIME_BOMB explosion shows bomb first, then surrounding stones.
- Target selection highlights do not modify disc appearance.
- No mid-playback full rerender; no UI diff inference of missing events.




