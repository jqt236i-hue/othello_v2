# ゾンビ感染時の通常反転抑止 設計

## 目的

ゾンビの意志の感染成立時、感染先を通常のオセロ反転として見せず、既存の噛みつき演出の完了後に自色の屍石へ変化させる。ゲーム状態、感染対象の選択、ネットワーク契約は変更しない。

## 現状と原因

感染ロジックは `BoardOps.changeAt` に感染元の所有者色、`cause: 'ZOMBIE'`、`reason: 'zombie_infection'` を渡して対象を更新する。この `CHANGE` プレゼンテーションイベントは UI 変換で一律 `flip` へ変換され、`animation-flip-events.ts` が噛みつき演出後にも通常の `triggerFlip()` と反転時間待機を実行する。そのため、感染の状態更新は正しくても見た目だけが通常反転になる。

## 採用する設計

`ui/animation-flip-events.ts` で `cause === 'ZOMBIE'` かつ `reason === 'zombie_infection'` のターゲットを感染専用として識別する。既存の `playZombieBiteAnimation` を完了したら `syncDiscVisual(disc, after)` を1回呼び、通常反転向けの `PlaybackFlipMarker.markPlaybackFlippedDisc`、`animationShared.triggerFlip`、`flipMs` の待機を行わずに再生を完了する。

感染以外の `CHANGE` イベントは既存の `flip` 経路を維持する。既存の `CHANGE` / `flip` イベント契約を変更しないため、ゲーム、Worker、ローカルサーバー、UI アダプタ間の互換性を保てる。

## 再生順と縮退

- 通常時: 噛みつき演出（黒紫の影と牙）→ 屍石の見た目へ同期 → 完了。
- アニメーション無効時または縮退時: 一時 DOM を作らず、屍石の見た目へ即時同期して完了。
- 感染先が取得できない、不発の場合: 現行どおり噛みつき演出を出さない。

## 変更対象と非対象

- 変更対象: `ui/animation-flip-events.ts` とその focused test。
- 非対象: `game/logic/cards/zombie_will.ts` の所有権更新、`game/turn/pipeline-ui/board-event-mapper.ts` の全体的な `CHANGE`→`flip` 契約、Worker、カード本文、ルールブック。
- `01-rulebook.md` と `正本/演出正本.md` は既に「牙が閉じた後に屍石へ変化」と定めており、仕様変更を伴わないため編集しない。

## 検証

- 感染時、噛みつき完了後に見た目同期が行われ、通常の `triggerFlip` が呼ばれないことを JSDOM focused test で確認する。
- 通常の反転イベントは引き続き `triggerFlip` を呼ぶことを同テストで確認する。
- ゾンビ感染のゲーム状態とプレゼンテーションイベントの既存テストを回帰確認する。
- UI の root ソース変更のため、focused test 後に `npm run build:browser` を実行してブラウザ用レジストリを更新する。実機ゲーム操作は行わない。
