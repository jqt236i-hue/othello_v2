# ネット対戦公開ライブ確認 2026-06-22

## 結果

PASS。公開 URL `https://card.reversi-0.workers.dev/` で Chrome を黒 host、Microsoft Edge を白 guest として別プロファイル/別ブラウザで確認した。

## 実行条件

- 実行日時: 2026-06-22 22:17 JST
- 公開 URL: `https://card.reversi-0.workers.dev/?debug=1`
- roomId: `ZDA`
- Chrome host: `HeadlessChrome/149.0.0.0`
- Edge guest: `Edg/149.0.0.0`
- 2026-07-11 に raw JSON・スクリーンショットを artifact retention policy に従って削除した。以下の本文が保存する結果要約であり、現在の回帰根拠には現行の自動契約テストを用いる。

## チェック項目

| 項目 | 結果 | 証跡 |
| --- | --- | --- |
| 部屋作成 | PASS | Chrome host が room `ZDA` を作成 |
| 部屋参加 | PASS | Edge guest が white seat で参加、両者 stateVersion `1` に収束 |
| host 初手同期 | PASS | Chrome が `(row=2, col=3)` を着手、両者 stateVersion `2` に収束 |
| 非手番ガード | PASS | Chrome 非手番クリック後も hash/stateVersion が不変 |
| guest 応手同期 | PASS | Edge が `(row=2, col=2)` を着手、両者 stateVersion `3` に収束 |
| refresh/reconnect | PASS | Edge reload 後、room `ZDA` に復帰し両者 stateVersion `3` に収束 |
| publish 500 | PASS | Chrome `0`, Edge `0` |
| unexpected publish 409 | PASS | Chrome `0`, Edge `0` |
| duplicate visualSeq playback | PASS | Chrome `0`, Edge `0` |
| direct board write during playback | PASS | Chrome `0`, Edge `0` |
| stuck busy lock | PASS | Chrome/Edge とも `processing=false`, `cardAnimating=false`, `playback=false` |
| final canonical board hash | PASS | Chrome/Edge の hash と stateVersion が一致 |

## 最終 canonical state

- Chrome stateVersion: `3`
- Edge stateVersion: `3`
- currentPlayer: `1`
- turnNumber: `2`
- final hash: Chrome/Edge 一致

## 証跡の保持範囲

当時のスクリーンショットと raw JSON はブラウザ実行時の一時出力であり、2026-07-11 の retention policy により追跡対象から外した。この文書の結果表・canonical state・Console / Network Summary が保存するコンパクトな結論である。現在の挙動確認には `npm run test:network:parity` と関連する契約テストを用いる。

## Console / Network Summary

### Chrome host

- page error: `0`
- publish statuses: `[200]`
- publish 500: `0`
- publish 409: `0`
- unexpected match request failure: `0`
- console error count: `82`
- 4xx/5xx response count: `82`

### Edge guest

- page error: `0`
- publish statuses: `[200]`
- publish 500: `0`
- publish 409: `0`
- expected SSE abort during reload: `1`
- unexpected match request failure: `0`
- console error count: `103`
- 4xx/5xx response count: `103`

## 4xx Resource Notes

console error は match API ではなく、公開環境のアセット 404 が中心だった。代表例:

- `assets/images/hero/HERO.png`
- `assets/images/hand-skin/勇者の手.png`
- `assets/images/background/デフォルト25.png`
- `assets/images/other/観測石.png`
- `assets/images/card/88_援軍の意志.png`
- `assets/images/card/89_平等の意志.png`
- 複数の `assets/audio/sound-effect/*.mp3`

これらはネット対戦の publish/snapshot/reconnect 判定には影響しなかったが、公開アセット配信の残リスクとして別途扱う。

## 残リスク

- 公開ライブ確認では低リスク通常着手、非手番ガード、reload reconnect を確認した。カードの pending target selection は公開環境では実施していないが、ローカル二クライアント E2E の `test/e2e/network-battle-complete-smoke.test.ts` で確認済み。
- Edge reload 時の `/api/match/stream` `net::ERR_ABORTED` はページ reload に伴う既存 SSE の切断で、再接続後の state sync と canonical hash 一致を確認済み。
- 公開アセット 404 はネット対戦同期とは別の配信/アセット問題として残る。
