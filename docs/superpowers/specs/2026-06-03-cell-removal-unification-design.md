# セル消滅統一 設計

## 目的

穴マス化を「石を破壊してから穴にする個別カード効果」ではなく、「対象セルをセルごと消滅させて穴にする共通ルール」として再定義する。これにより、`生きる意志`、`復活の意志`、`破壊回避` のような石ローカルの延命処理を穴化経路から外し、`絶対保護` だけを唯一の例外として扱う。

この変更は仕様変更とリファクタリングをセットで行う。目的は挙動の単純化だけではなく、`METEOR_WILL`、`BOARD_SHRINK_WILL`、`BOARD_SHRINK_GOD`、`CELL_TELEPORT_WILL` の穴化経路を同じ `BoardOps` 契約へ統一し、カード個別の分岐を減らすことにある。

## 確定方針

- `METEOR_WILL`
- `BOARD_SHRINK_WILL`
- `BOARD_SHRINK_GOD`
- `CELL_TELEPORT_WILL` の移動元穴化

上記はすべて `セル消滅` ファミリーとして扱う。

セル消滅の共通ルールは次のとおりとする。

- 対象セルに `絶対保護石` がある場合だけ不成立。
- それ以外では、石・封鎖・凍結・種・通常の保護状態・石状態をまとめて消し、セルを穴マスへ変える。
- `生きる意志`、`復活の意志`、`破壊回避`、`幽体`、`完全保護` はセル消滅を止めない。
- 盤面縮小系と隕石で石が乗っていたセルは、見た目上はこれまでどおり `DESTROY` -> `STATUS_APPLIED(METEOR_HOLE)` を維持してよい。
- `CELL_TELEPORT_WILL` は石を先に移動してから移動元セルを消滅させるため、移動元セルに `DESTROY` は出さず、`STATUS_APPLIED(METEOR_HOLE)` だけを出す。

## 残すもの

今回の設計では、`石の救済` のような「破壊後の外部フック」は全面的には組み替えない。既存の occupied cell removal が持つ `救済神` の記録・遅延復活キューは維持寄りで扱う。

理由は、今回の主眼が「セル消滅は石ローカルの延命処理を発火させない」ことにあり、`救済神` まで同時に切ると仕様変更の範囲が広がりすぎるためである。

## 実装境界

- 正本の共通入口は `game/logic/board_ops.ts` の `applyCellRemovalAt()` に寄せる。
- `applyHoleAt()` は低レベルの穴 marker 反映に留め、ルール判定の入口にはしない。
- `game/logic/cards/meteor.ts`、`game/logic/cards/shrink.ts`、`game/logic/cards/teleport.ts` は、個別に `destroyAt() + applyHoleAt()` を組み立てず、同じセル消滅 helper から `applyCellRemovalAt()` を呼ぶ。
- `CELL_TELEPORT_WILL` の移動元穴化も、`applyHoleAt()` 直呼びをやめて `applyCellRemovalAt()` を使う。

## 削る例外

- `applyCellRemovalAt()` 内の `生きる意志` 専用復活分岐。
- `meteor.ts` / `shrink.ts` の「`applyCellRemovalAt()` が無い時だけ別ロジックで破壊して穴化する」意味差分。
- `teleport.ts` の `leaveMeteorHoleAt()` による別経路。

## 非目標

- `絶対保護` の仕様変更。
- `worker-public/` の手編集。
- 穴マス画像や音名の刷新。
- `救済神` の仕様全面変更。

## 検証の焦点

- `隕石` と `盤面縮小系` で `生きる意志` が復活しないこと。
- `隕石` と `盤面縮小系` で `復活の意志` と `破壊回避` が発火しないこと。
- `CELL_TELEPORT_WILL` の移動元穴化が `cellRemovalCause: 'CELL_TELEPORT_WILL'` を持つ共通 `STATUS_APPLIED` になること。
- `絶対保護` だけが不成立理由として残ること。
- occupied cell removal の playback 順と `救済神` キュー順を壊さないこと。
