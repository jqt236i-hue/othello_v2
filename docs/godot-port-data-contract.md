# Godot移植用の対局データ・保存契約

役割は、他言語が現在の対局APIと同じJSONを読み書きするための境界仕様。対象は設定、正本状態、操作、遷移、演出入力、結果、保存互換性。正本は [公開API](../game/battle/index.ts)、[保存検証](../shared/battle/save.ts)、[状態検証](../shared/battle/state-validation.ts)、[機械可読契約](../shared/battle/data-contract.ts)、ゲームルールは [ルールブック](../01-rulebook.md)。Godotのクラス構造、描画実装、ゲームルールの変更、任意の破損状態の修復は対象外。

## 機械による判定

既存の `@card-reversi/battle` 公開入口に `getBattleDataContract()` と `validateBattleData(kind, value)` を追加した。別のゲームエンジンや保存形式は作らない。構造検査とルール上の合法手判定は区別する。例えば初期盤面への `pass` はJSONとして正常だが、`apply()` が `ok:false` を返す。

```powershell
npm run build:ts
node dist/scripts/godot-data-contract.js schema output/godot-data-contract.json
node dist/scripts/godot-data-contract.js validate config test/fixtures/battle-contract/config-valid.json
node dist/scripts/godot-data-contract.js validate save test/fixtures/battle-save-current-v1.json
node dist/scripts/godot-data-contract.js validate save test/fixtures/battle-contract/save-invalid.json
```

最後のコマンドは意図的に失敗する異常例（未知の効果名）。成功は終了コード0と `ok:true`、失敗は1と `error`。`schema` の出力は本プロジェクト固有の契約カタログであり、JSON Schema規格のスキーマではない。検証の正本は同じAPIを使う `validate`。Godotからは任意の完成状態JSONを `validate position <file>`、遷移を `validate transition <file>` で検査できる。状態到達可能性の証明ではなく、以下の構造・列挙・参照・盤面整合性を検査する。

正常・異常実例は [battle-contract](../test/fixtures/battle-contract)、完全な正常保存は [battle-save-current-v1.json](../test/fixtures/battle-save-current-v1.json)。`config` / `save` / `position` / `transition` / `action` / `result` / `events` / `playbackEvents` が入力種別。テストは [battle.data-contract.test.ts](../test/battle.data-contract.test.ts) が同じCLI入口で実例を検証し、[Godot比較ケース](../test/fixtures/godot-conformance-2026-10-03/expected.json) の全境界状態を保存契約で検査する。

## JSON共通条件と版

UTF-8のJSONファイルを用いる。文字列の内容はUnicode、JS側ハッシュでの走査単位はUTF-16。オブジェクトキー順は意味を持たないが、配列順は意味を持つ。配列は密な配列で、省略要素や追加プロパティを認めない。`undefined`、NaN、Infinity、関数、getter、非plain object、`__proto__` / `prototype` / `constructor` キーを拒否する。省略と `null` は区別し、数値文字列の自動変換はしない（CPU profileの数字指定だけは設定API既存の明示的正規化）。

| 識別子 | 現在値・役割 |
| --- | --- |
| `contractVersion` | 機械可読カタログの版 `1`。APIの各データに新しい包みを追加しない |
| `config.version` | 設定版 `1` |
| `formatVersion` | 保存形式 `1` |
| `rulesVersion` | `card-reversi.rules.v1`。効果実装・順序などの意味変更時は明示更新が必要 |
| `contentVersion` | `fnv1a32:b9a25d73`。全100種のruntimeカード定義を下記の方法で識別 |
| PRNG checkpoint | `{seed:uint32,calls:整数0..10000000}`。seedは設定と一致 |

保存文字列は8 Mi文字、300,000ノード、深さ80以内。整数は特記がなければ0〜`9007199254740991`（JS safe integer）。量の上限とゲーム内で実際に到達する値は同じ意味ではない。ルール上の布石は0〜99、倍率は1〜100。未知の形式・ルール・内容は拒否し、新規対局へ置き換えない。

## 設定

| 項目 | 必須・型・省略時 |
| --- | --- |
| `version` | 必須、整数1 |
| `battleId` | 必須、正規表現 `[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}`。一戦ごとに一意 |
| `seed` | 必須、整数0〜4294967295 |
| `board` | 省略可、`{rows:8,cols:8,shape:"rectangle"}`。rows/colsは整数4〜16、shapeはrectangle/circle。shapeだけ省略可 |
| `players` | 省略可。black/whiteを個別省略可。黒human、白cpu、profile 1 |
| `players.*.controller` | seat指定時必須、human/cpu |
| `players.*.profile` | 省略可。既存profile IDまたは対応レベル。解決済み保存は文字列の正規ID |
| `players.*.deckCardIds` | 省略可、有効な初期デッキ用ID配列、最大512。空配列は空デッキ |
| `players.*.initialCharge` | 省略可、整数0〜99。0は有効 |
| `players.*.chargeGainMultiplier` | 省略可、整数1〜100 |
| `initialLayout` | 省略可。`stones:[{row,col,owner:1|-1}]` 必須、`currentPlayer:1|-1` 省略時1。盤内・形状内、重複不可 |

設定の未知フィールドと `null` は拒否する。明示したseat値がprofile由来の初期値に優先する。`enabled:false` の三連鎖・四連鎖・無限連鎖と三連投石・四連投石・無限投石は初期デッキに直接指定できないが、ゲーム中に生成される正式なカードであり、状態・保存・操作には有効。

## 正本状態と保存

保存は必須の `{formatVersion,rulesVersion,contentVersion,config,position,phase,cpuMemory}`。`config` は解決済み設定。`position` は必須の `{gameState,cardState,prngState}`。`cpuMemory` はホストのCPU継続メモリーを入れるplain JSON objectで、空 `{}` も有効。CPUモデル自体は入れない。

| `gameState` | 表現と条件 |
| --- | --- |
| `board` | rows×colsの密な二次元配列。0=空、1=黒、-1=白。形状外の配列要素は石を置けない |
| `boardConfig` | 解決済みrows/cols/shape、baseBounds/outerBounds等の既存派生情報。保存設定と一致 |
| `currentPlayer` | 1/-1。制御者は別途cardStateの運命効果を参照 |
| `turnNumber` | 整数0〜10000000 |
| `consecutivePasses` | 整数0〜2。2だけがterminal |
| `roundNumber` | 1以上の整数 |
| `roundCompletionByPlayer` | black/whiteのboolean |
| `pendingRoundBonus` | `null` または `{roundNumber,amount}`、roundNumberは現在以下、amountは正整数 |
| `boardExpansion` | 正本の拡張descriptor。`cells`は `{row,col,side,owner}` 配列、ownerは-1/0/1。旧single-cell投影も現行保存が保持 |

座標は0始まりの `{row,col}`。拡張により負数や元配列の外側も有効なので、一律0..7で切らない。境界の数値検査は整数-256〜256、実際に存在・配置可能かは [盤面kernel](../shared/board/state-kernel.ts) のトポロジーで判定する。穴は通常石の値や描画非表示だけで表さず、`METEOR_HOLE` 等の正本markerに由来する。

`cardState` は [完全保存実例](../test/fixtures/battle-save-current-v1.json) のfactory項目を保持し、他言語で必要な項目だけ拾って残りを捨てない。重要な型群は次のとおり。

| 型群・項目 | 表現と条件 |
| --- | --- |
| `hands`, `decks`, `discard` | black/whiteごとのカードID配列、discardのみ共通配列。順序を保持、配列最大16384。`deck`は旧互換投影で独立の新ルールにしない |
| `_handCopyIdsByPlayer`, `_deckCopyIdsByPlayer`, `_discardCopyIds` | 対応するカード配列と同じ長さ。整数IDは全zoneで一意、1以上 `_nextCardCopySeq` 未満 |
| `_revealedHandCopyIdsByViewer` | black/whiteのcard copy ID配列。保存中のcard copyに参照可能 |
| `stoneIdMap` | boardと同じ大きさ。石は `s1` 等の `s[1-9][0-9]*`、空は `null`。数字IDと空0は公開保存では不正 |
| `expansionStoneIdByCell` | `"row,col"`→石ID。盤内mapと合わせ一意。拡張に石があるときだけ存在 |
| `_nextStoneId`, `_nextMarkerId`, `_nextCreatedSeq`, `_nextCardCopySeq`, その他`_next*Seq` | 正整数。既存IDと衝突しない。使用済IDを再利用しない |
| `charge`, `chargeGainMultiplierByPlayer` | black/white数値。布石0..99、倍率1..100 |
| `turnCountByPlayer`, `extraPlaceRemainingByPlayer`, `timeStopConsecutiveTurnsRemainingByPlayer`、使用/反転/角/数字の集計 | black/whiteの非負整数。タイミングはルール資料で別途定義 |
| `hasUsedCardThisTurnByPlayer`, `hasDestroyedCardThisTurnByPlayer`, `infinitePlaceActiveByPlayer`, `workNextPlacementArmedByPlayer` | black/white boolean |
| `lastTurnStartedFor`, `_activeTurnPlayer` | black/white/null |
| `lastUsedCardByPlayer` | black/whiteそれぞれカードID/null。表示名や説明のobjectを入れない |
| `selectedCardId` | カードID/null。選択がないことを省略に置き換えない |
| `fateWillControllerByTurnOwner` | black/whiteそれぞれblack/white/null |
| `pendingEffectByPlayer` | black/whiteそれぞれ下記pending/null |
| `activeEffectsByPlayer` | black/whiteの効果record配列。typeは正式カード効果enum |
| `riboRepaymentsByPlayer`, `observerWillRepaymentsByPlayer` | black/white配列、remainingOwnerTurns/repaymentAmount/shortageDestroyCountは非負整数。観測の識別情報も保持 |
| `cardCostOverridesByCopyId` | copy ID文字列→`{cost,sourceType}`、cost非負整数、sourceTypeは正式効果名/null |
| `cardCostModifiersByCopyId` | copy ID文字列→`[{delta,sourceType}]`、deltaは符号付きsafe integer |
| `boardBonusByCell`, `boardBonusConsumedByCell` | canonical `"row,col"`→非負整数、消費済mapは値true。理論の化身はカードコストを数字にするため0や10超も有効 |
| `nextObserverWillStoneByPlayer`, `nextBoardExecutorStoneByPlayer`, `nextTheoryIncarnationStoneByPlayer` | 3つのmapと各black/whiteキーは必須。値は下記の予約record/null。mapやownerキーの省略、文字列化は拒否 |
| `theoryIncarnationStateByPlayer`, `theoryNumberCellsBySession`, `theoryNumberCellByCell` | 必須の理論session状態・記録・逆参照map。下記の型・参照を保持 |
| `workAnchorPosByPlayer`, `breedingFrontierByAnchorId`, `breedingSproutByOwner`, `prevOpponentTurnDestroyedStonesByPlayer`, `pendingStoneSalvationGodRevivesByPlayer` | 効果の位置・履歴・復活予約。既存record/配列を保存し、表示キャッシュとして捨てない |

効果ごとの追加情報は現行recordのまま保持する。全フィールドの到達可能な組合せを検査する証明器ではない。特定の効果内部recordの追加キーはbounded JSONとして保持し、今回追加したvalidatorは型の明らかな不正、正式でない効果名、既知カウンター、marker/カード/石参照、盤面の不整合を拒否する。

markerは `{id,markerId,row,col,kind,owner,createdSeq,data}`。id/createdSeqは正整数、markerIdはidの10進文字列で、それぞれ一意。kindは `specialStone` / `manifestStone`、ownerはblack/white/null。`data.type` の閉じたenumは `schema.markerTypes` を用い、[SpecialStoneRegistry](../shared/special-stone-registry-static.ts) に従う。石本体・石の付与状態・マス効果をkindだけから推測しない。categoryは省略またはbomb、bombはTIME_BOMB。残り時間・回避回数は存在時に非負整数。石本体/付与状態にはその座標の石が必要。`METEOR_HOLE`は穴そのものを表すため通常の「石が存在する」検査の対象外。

pendingは `{type,cardId,stage,...}`。typeは `schema.pendingEffectTypes`、stageは型ごとに `schema.pendingStageByType` の1値と一致させる。正本の [pending selection registry](../game/logic/cards-internal/pending-selection-registry.ts) の37選択型（転生を含む）はselectTarget、その他はnullで、選択途中にstageは変わらない。cardIdは必須で、そのtypeと一致。sourceHandIndex/selectedCount/maxSelections/placementsRemainingは存在時に非負整数。firstTargetは省略/null/座標、selectedTargetsは座標配列とselectedCountが一致する。拡張神/縮小の意志はselectedTargets・selectedCount・maxSelectionsが必須、maxは拡張神1〜2/縮小3。拡張神selectedTargetsの各要素にはdirectionKeyも必須で、up-left/up-right/down-right/down-leftの4値だけを許可する。最後の切り札はplacementsRemaining1〜3が必須。天の恵み/観測/断罪は非空offersが必須。機械列挙はschema.pendingRequiredFieldsByType。入替・超引力・縮小神等の途中選択を保存してよい。offersは天の恵みならカードID配列、断罪なら `{handIndex,cardId}` 配列、観測ならさらにcardCopyIdを含み、対象の相手手札と一致する。

顕現予約は `schema.reservations` に必須フィールドを列挙する。盤上の執行者は `{sourceType:"BOARD_EXECUTOR"}`。観測は `{sourceType:"OBSERVER_WILL",repaymentId,stolenCardId,stolenCardCopyId,repaymentIndex,createdTurnNumber}` で、repaymentIdは同じownerの未顕現・待機中返済recordを指し、カードID/copy IDはその履歴recordに一致する。奪ったカードの破壊・使用後も次の配置への予約は続くため、現在の手札に残っていることを要求しない。repaymentIdは `observer_will_repay_<owner>_<正整数>`、整数部分は次の採番未満。repaymentIndexは非負整数の旧fallback位置であり、後の返済配列の削除に耐える参照はrepaymentIdが担う。createdTurnNumberはnullまたは0..現在turnNumber。返済recordのsourceType・status（waiting_for_marker_expire/active）・card/copy ID・baseCost・markerIdも必須で、markerIdは未顕現時null、以後は次の採番未満の正整数。期限後も返済が残るため、履歴markerIdに現存markerは要求しない。

理論の化身は `{sourceType:"THEORY_INCARNATION",sessionId}`。sessionIdは `theory_<owner>_<正整数>`（次の採番未満）で、同じownerのtheoryIncarnationStateByPlayerとtheoryNumberCellsBySessionに参照可能でなければならない。逆方向にも、pending.typeがTHEORY_INCARNATIONの配置待ち状態なら、そのownerの予約は必ず非nullでなければならない。owner状態はownerKey、sessionId、非負整数remainingSpawnCountが必須。createdTurnIndexとmarkerIdは存在時に非負整数/正整数で、runtimeのmarker復元fallbackでは省略され得る。fallbackのsessionId:nullは有効だが、新しい予約のsessionIdにはnullを認めない。sessionにはownerKeyとcells mapが必須。各cellのキーとrow/colは一致し、value/originalValue/sourceCardCostは非負整数、originalConsumedはboolean、consumedは省略またはboolean。sourceCardId/type/costは正式カード定義と一致し、spawnTypeとmarkerData.typeは同じ正式marker型。theoryNumberCellByCellの各項目は同じowner/session内の未消費cellを指す。

救済神のpendingStoneSalvationGodRevivesByPlayerもmap・black/white配列が必須。各予約のrow/col、owner（配列ownerと同一）、destroyedOwner、cause/reason（文字列/null）、queuedTurnIndex（非負整数/null）は必須。metaは省略/null/object。復活元のmarkerが失われた場合はruntimeが失敗結果を返すため、元markerの現存を保存の条件にはしない。労働の次配置予約workNextPlacementArmedByPlayerは従来どおり両ownerのbooleanが必須。

検査限界として、firstTargetは未選択時に正当に省略される唯一の進捗情報であり、途中保存からそれだけ削除したデータと未選択状態を現在の形式で判別できない。sourceHandIndexもnoConsume経路では省略可能だが、通常使用の捕獲で削除すると手札挿入順が変わるため、保存者は既存値を落としてはならない。盤上の執行者は使用時点からpendingがnullで、顕現予約をnullへ置換した事実を判別する独立の進捗項目がない。map・ownerキーの省略は拒否するが、lastUsedCardなどの履歴から予約の存在を推測して正常保存を拒否しない。完全な状態到達可能性や失われた履歴の推定はこのvalidatorの責務に含めない。

`phase` は needs-turn-start / action / terminal。保存されたphaseをそのまま復元し、actionのセーブに対する `startTurn()` はnullを返してドロー・持続効果・乱数を二重適用しない。描画キュー、関数、`__resultShown` / `__resultToken` は保存対象外。復元は過去の演出を再生しない。

## 操作・遷移・イベント・結果

`BattleSession.apply(action)` は入力のJSONと形を検証し、現在のpipelineで合法性を判定する。typeはplace/use_card/pass/cancel_card/destroy_hand_card。use_cardにはuseCardId、destroy_hand_cardにはdestroyCardIdが必須。通常placeはrow/col、対象選択は `schema.actionTargetFields` の対応フィールドに座標を渡す。手札対象はcondemnTargetIndex/observerWillTargetIndex、天の恵みはheavenBlessingCardId。任意のuseCardHandIndexは0..16383、useCardOwnerKeyはblack/white。null座標・未知項目・debug/強制pass等のauthority専用パラメーターは公開ホスト操作で受けない。内部互換のBattleMatchはこの外部境界を置き換えない。

遷移は `{kind,player,before,after,ok,reason,events,action?,stopAction?}`。kind=turn_start/action、player=black/white、before/afterは完全position。action kind時はaction必須。ok=trueならreason=null、falseなら非空理由文字列。stopActionは存在時boolean。拒否でも乱数消費があればcheckpointに残る現行pipeline契約を維持する。例外は壊れた入力、破棄済み、進行phase違反、runtime不在等を示す。

`events` は配列順を保持するロジック結果record。typeは非空の英数underscore文字列（先頭英字）で、診断用途の拡張recordを保持する。`playbackEvents` は別の [再生契約](../shared/playback-event-contract.ts) でphase・座標・owner・status subjectKind/stoneMutationを検査する。ロジックeventsにphase必須の再生形式を押し付けない。Godotは未知の演出を正本状態の変更命令に変換してはいけない。演出・効果音資料は [godot-port-presentation.md](godot-port-presentation-lifecycle.md)。

結果は未終了ならnull、終了時は `{black,white,winner,endedBy,turnNumber}`。black/whiteは正本countDiscsの整数結果、winnerはblack/white/drawで大小関係と一致、endedByはconsecutive_passes。満盤、キャンセル、演出エラーは別の勝利条件を作らない。外部報酬の一意性と中断は [戦闘組み込み契約](battle-integration.md) のresultIdとホスト保存が所有する。

## 互換性と比較基準の調査結果

2026-09-22に転生9件と保存7件は成功し、旧互換テスト2件を再現した。旧replayの基準commitは `592359fec1b263ab8c2c652c5fbe232ef848ecca`、カード追加は `bfd7ee62691436731abd9ba5bd1b38ce4a7bee5c`。標準デッキの候補追加によりシャッフルの入力と乱数消費が変わり、その後の数字マス・ドローも変わる。seed319は初回境界calls267→268、seed914001/profile10は273→275。旧操作列を新しい初期デッキに流すと20件の採否が変わり、終局へも達しなかった。これは旧goldenの適用範囲が古いことで、転生の仕様違反を示すものではない。

| データ | 扱い |
| --- | --- |
| [battle-before-refactor.json](../test/fixtures/battle-before-refactor.json) | 歴史記録を変更せず保全。上記旧commit専用、新カード入り初期化のgoldenに転用しない |
| [battle-save-v1.json](../test/fixtures/battle-save-v1.json) | 旧内容 `fnv1a32:fce6c0f5`。現在は明示拒否。移行方式を捏造しない |
| [battle-save-current-v1.json](../test/fixtures/battle-save-current-v1.json) | 現在全カード定義で作った保存。開始済みターンを二重処理しないことを固定 |
| [battle-replay-current-v1.json](../test/fixtures/battle-replay-current-v1.json) | 現在の通常初期化から133境界。拒否pass、合法手列、連続pass終局。全状態・乱数・ロジックeventsを保存 |
| [godot-conformance](../test/fixtures/godot-conformance-2026-10-03) | 全カード基本/拒否、対象選択、重要な組合せ・盤面変化。旧goldenの不足を別ケースで補う |

実不具合として、従来保存検査が初期デッキ用enabled IDだけを許可し、対局中に生成される派生カードを拒否していた。保存用ID集合をruntime全定義へ直し、初期デッキの制限は維持した。新しい検査の適用時には理論の数字マスや観測/断罪の手札offerを正本実装に合わせ、正常な671状態を拒否しないことを確認した。

同日の独立再レビューで、顕現予約3種の欠落・文字列化と型に合わないpending.stageが受理され、復元時の既定値補完で予約や選択が失われる未検査箇所を確認した。保存検証の完全性に関する以前の説明をこの追補で訂正する。修正前の回帰は予約3件とstage1件が失敗、正常な顕現再開3件は成功した。上記の必須型・参照検査、救済神予約の型、拡張神の方向検査を追加し、ルールの処理順・効果自体は変更していない。証拠は `output/godot-port-preparation/review-fixes-20260922/save-before-fix.txt` と同ディレクトリの修正後ログ。

続くレビューでは、観測で奪ったカードを合法的に手札破壊した後の保存を、現手札への参照条件が誤って拒否することと、理論の配置待ちpendingが残っているのに予約をnullへ置き換えた状態を受け入れることを各1件再現した。前者は返済recordの履歴参照として検査し、後者はpendingから予約への逆整合を追加した。正常な手札破壊→保存→復元→同じ配置での顕現と、理論の矛盾状態の拒否を回帰に追加。修正前ログは同ディレクトリの `observer-destroy-before-fix.txt` / `theory-null-before-fix.txt`、修正後は `save-final-recheck-tests.txt`。

旧方式は表示説明まで含むカード全文hashだった。新方式ではruntime定義のname/desc/display_type_ja/card_face_art_pathだけ除外し、全100カード（派生を含む）のid/type/cost/enabled、配列順、その他の定義項目をhashに含める。同じ仕様と確認した既知の旧全文hash `fnv1a32:f89cfb79` から `fnv1a32:068d90fd` への対応は、延命の意志のコストが4だった旧ルールに限定する。この既知旧版でブラウザがlastUsedCardByPlayerへ誤保存した表示descriptorは、ちょうど{id,name,desc}の3項目・正式card ID・文字列の表示項目を検査してIDへ移す。現在のコスト6の内容hashは `fnv1a32:b9a25d73` で、両旧hashの保存を明示拒否する。現在semantic版のdescriptorや、未知hash・将来版も受けない。意味が変わった版へ固定対応を流用しない。

現在のgolden再生成は次の明示コマンドで行う。履歴2ファイルを上書きしない。ルール検査が失敗したまま期待値だけ更新する手順ではない。

```powershell
node dist/scripts/godot-data-contract.js fixtures --write-current
npm run test:jest -- --runTestsByPath test/battle.compatibility.test.ts test/battle.session.test.ts test/battle.data-contract.test.ts test/game.reincarnation-will.test.ts
```

保存envelopeのchecksumは `Hash.computeStableHash(data)`、暗号的な認証ではない。2スロット保存は破損時のみ以前の互換世代を復旧しrecovered=true。未知の将来版なら古い正常slotがあっても勝手に戻したり上書きしない。失敗した書込みが確定済み世代を壊さないこと、manifest失敗、破損復旧、将来版拒否をテストしている。

## 乱数・ハッシュの他言語実装

PRNGは `state=(state*1664525+1013904223) mod 2^32`、戻り値はstate/4294967296。uint32のseedからcalls回進めた位置を復元する。Fisher–Yatesは末尾indexから1まで、毎回 `j=floor(random()*(i+1))`、そのi/jを交換する。並べ替え、候補除外、同点順、乱数を呼ぶ回数を独自に変えない。正解列と転生候補順は [決定性の比較値](../test/fixtures/godot-conformance-2026-10-03/vectors.json) を使う。

状態hashはキーをJSのUTF-16辞書順でsortするstable JSON→FNV-1a32。初期値2166136261、文字列の各UTF-16 code unitとxor、16777619を掛け下位32bitにする。`fnv1a32:` + 小文字8桁hex。UnicodeをUTF-8 bytesとしてhashすると一致しない。数値はJS `String(number)`、-0は0、非有限値はhash helperではnullになるが、公開入力検査では拒否する。配列の順と未指定/nullの差を保持する。途中hashのみで原因を隠さず、比較ケースの完全stateと最初に違ったフィールドを併用する。
