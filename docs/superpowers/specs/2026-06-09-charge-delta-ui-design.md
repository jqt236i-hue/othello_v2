# Charge Delta UI Design

## Goal

`+11` / `-3` の布石増減バッジを、盤面の上で浮きすぎる丸いゲーム用バッジから、黒金の細い刻印チップへ置き換える。

## Direction

- 形状は横に尖りを持つ細い金属片とし、従来の羽根状の張り出しは廃止する。
- 増加は青黒、減少は赤黒を維持し、どちらも細い金縁で統一する。
- 縦幅、光沢、内側の発光を弱め、盤面の情報を邪魔しない瞬間表示にする。
- 数字は太すぎる白塗りではなく、少し細めの冷たい刻印調に寄せる。

## Implementation

- `styles-variables.css` で charge delta の高さ、余白、角度用の変数を整理する。
- `styles-layout.css` の `.charge-delta` を羽根付きカプセルから、clip-path を使った薄い刻印チップへ変更する。
- `test/ui.board-hud-layout-contract.test.ts` の CSS 契約を新デザインに合わせて更新する。

## Verification

- `npx jest --runInBand test/ui.board-hud-layout-contract.test.ts`
