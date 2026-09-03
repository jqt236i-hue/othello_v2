# 実機探索チャーター

この資料は実ブラウザで探索するときだけ読む。依頼、症状、現在の差分、最近変更された境界に合うチャーターを選び、無関係な全組合せは回さない。広いバグハントでは基礎チャーターに加え、リスクが高い順に追加する。

## チャーターの選び方

優先順位は次の順に決める。

1. ユーザーが示した症状とその直前・直後の状態遷移
2. task-ownedまたは現在調査中の差分が触れる経路
3. authority、pending selection、playback settlement、入力lock、network reconnectなど、失敗時に進行不能や不一致を生む境界
4. 同じ契約を持つruntime、entry lane、backend間の差
5. 見た目、responsive、低頻度の回復経路

各チャーターでは「通常」「繰り返す」「境界値」「途中で中断する」「回復する」「同等経路と比較する」から有効な観点を選ぶ。一度に一条件だけ変え、原因が混ざらないようにする。

## 基礎：起動から通常対局

- 正規URLで最初の操作可能画面まで到達する。
- game mode、デッキ、先後など通常UIで選べる前提を確認する。
- 有効な着手を行い、盤面、手札、コスト、ターン表示、入力可否がsettleするまで観測する。
- 複数ターン進め、パス、CPU handoff、終了判定のうち到達可能なものを確認する。
- console error、page error、欠落asset、永久busy、入力不能がないことを確認する。
- 表示だけでなく、次の有効操作が成立するところまで確認する。

## 入力と状態遷移

- 有効セル、無効セル、盤外、すでに埋まったセルへの入力を比較する。
- pointer down/up、drag outside、素早い連打、二重クリック、animation中の再入力を試す。
- pending、playback、CPU処理の終了後に入力が必ず戻るか確認する。
- reset、新規対局、画面切替、モーダル開閉、focus喪失後に古いcallbackやlockが残らないか確認する。
- viewport resizeやscroll後、見えているセルと実際のhit targetが一致するか確認する。

## カード、pending selection、CPU

- 使用条件、コスト、対象候補、確定、キャンセル不能ならその明示、効果後のターン移行を確認する。
- 候補選択中の無効対象、二重決定、animation中入力、resetを調べる。
- card effectのcanonical result、`events[]`、最終表示、手札・コスト表示が一致するか確認する。
- CPUへ渡る前にselection processingが解放され、CPU後にプレイヤー入力が戻るか確認する。
- CPUの強さや好みはバグ根拠にせず、合法性、進行、明示されたdecision contractだけを判定する。

## 盤面、Pixi、playback

- active backendが一つだけで、PixiとDOM compatibilityが同時に描画・入力しないことを公開diagnosticsで確認する。
- 着手、反転、破壊、復活、特殊石、複数targetの開始順とsettlementを観測する。
- playback中に最終canonical boardが先描きされず、終了後にvisual stateがcanonical stateへ収束するか確認する。
- 盤面拡張、長方形、穴、負座標、viewport外のsource/targetで、座標・hit test・trajectory・clippingが契約どおりか確認する。
- resize、DPR変更、context restoration、backend replacement後に古いscene、ticker、callback、input ownerが残らないか確認する。
- 視覚候補は必ずスクリーンショットで確認し、semantic DOMだけを描画証拠にしない。

## Network authorityと回復

- 必要な場合だけlocal match authorityを起動し、黒・白の二クライアントと必要に応じてspectatorを使う。
- publishした操作が一度だけ適用され、両クライアントのstateVersionと盤面が収束するか確認する。
- 自分のpreviewやanimationがauthoritative snapshotを上書きしないか確認する。
- pending selectionが同じpending instanceへ結び付き、二重publishや古いoperationが拒否されるか確認する。
- reload、SSE切断、reconnect、遅延したpublish responseとstreamの順序逆転後に回復できるか確認する。
- terminal resultが正しいauthorityとvisual settlement後に一度だけ表示されるか確認する。
- spectatorや相手に非公開手札、seat token、内部hashが漏れないか確認する。

## Delivery、lane、fallback、responsive

- 通常は対象となる主entry laneを深く調べ、classic/Viteの比較はdelivery parityが関係するときだけ追加する。
- DOM compatibilityは明示選択、Pixi/WebGL初期化失敗、context loss回復などfallback契約に関係するときだけ調べる。
- desktopと狭いviewportで、盤面、手札、HUD、modal、主要操作が隠れず、入力座標がずれないか確認する。
- browser buildやmirrorの古さを製品バグと誤認しない。root source変更後の必要なbuildを行い、同じURLをreloadして再確認する。

## 探索の終了条件

- 選んだチャーターの主要状態遷移を最後まで操作した。
- 発見候補ごとに再現できた、再現できなかった、環境起因だった、仕様判断が必要だった、のいずれかを記録した。
- 最高リスクの候補は正常対照または隣接経路でも確認した。
- 未検証のlane、backend、network、viewportを明示した。

候補がなくても探索範囲を広げ続けない。依頼範囲とリスクに見合うチャーターを終えた時点で、「検証した範囲では確定バグなし」と報告する。

## 証拠メモ

候補ごとに最低限、次を残す。

- 環境：commit/dirty、URL、lane、backend、network、viewport
- 事前条件：mode、手番、盤面、カード、直前の操作
- 再現手順：通常UIで追える最短手順
- 再現性：試行回数と成功回数
- 期待結果：正本ファイルと該当箇所
- 実際の結果：画面、error、state/diagnostics
- 比較：正常系または同等経路との差
- 仮説：所有層と、まだ除外できていない原因
