# Charge Delta UI Design

## Goal

`+11` / `-3` の布石増減バッジを、硬いチップ感のある小型UIから、魂が下から浮かび上がってくるような霊火演出へ置き換える。

## Direction

- 推奨案は「霊火シジル型」。本体の板感は弱め、下端から青白い霊火がにじみ上がる瞬間表示にする。
- 増加は青白い霊火、減少は赤黒い怨火とし、色差は維持する。
- 演出強度は高め。ただし盤面中央を覆うほどの面積にはせず、布石UI周辺だけで完結させる。
- 数字は冷たい青白の芯を持つ細めの発光文字にし、輪郭の硬い金属感より「光で浮く」印象を優先する。
- 形状は完全な閉じた板ではなく、霊気の尾と薄い残光で輪郭がほどける半霊体寄りにする。

## Implementation

- `styles-variables.css` で charge delta の高さ、発光量、揺らぎ量、残光用の変数を整理する。
- `styles-layout.css` の `.charge-delta` を霊火主体の見た目へ変更し、下側の発光、薄い霧、数字の霊光を疑似要素で組む。
- `.charge-delta.is-increase` は青白系、`.charge-delta.is-decrease` は赤黒系の発光と影へ調整する。
- 既存の `is-visible` / `is-fadeout` の流れは維持しつつ、「下で燃える → 数字が浮く → 上にほどける」印象になるようにトランジションとぼかしを調整する。
- `test/ui.board-hud-layout-contract.test.ts` の CSS 契約を新デザインに合わせて更新する。

## Constraints

- 盤面の中央や着手可能マスのシアン強調より目立ちすぎないこと。
- charge delta は一瞬の情報提示なので、文字の判読性を落とさないこと。
- `ui/stone-visuals.ts` の左右アンカー配置と同時表示挙動は変えないこと。

## Verification

- `npx jest --runInBand test/ui.board-hud-layout-contract.test.ts test/ui.charge-delta-queue.test.ts`
