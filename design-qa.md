# CPU・盤面設定ポップアップ Design QA

- Source visual truth: `C:\Users\quarr\.codex\visualizations\2026\07\11\019f5189-3b1e-7e10-a1a1-58f7405e5d39\cpu-board-selector-ui.html`
- Source screenshot: `C:\Users\quarr\AppData\Local\Temp\cpu-board-selector-source.png`
- Implementation screenshot: `C:\Users\quarr\AppData\Local\Temp\cpu-board-selector-implementation-small.png`
- Full-view comparison: `C:\Users\quarr\AppData\Local\Temp\cpu-board-selector-comparison.png`
- Focused comparison: `C:\Users\quarr\AppData\Local\Temp\cpu-board-selector-comparison-focused.png`
- Viewport: 1280 × 720
- State: CPU対戦、CPU名ポップアップを開き、`盤面設定` タブで `円形 12×12` を選択

## Findings

- P0 / P1 / P2 の未解決項目なし。
- タブ、盤面形状、円形サイズ、選択中サマリーの構成はソース案と一致している。
- 通常盤面では縦横の個別セレクト、円形盤面では `6 / 8 / 10 / 12 / 14 / 16` のサイズボタンへ切り替わる。
- ソース案の汎用的な中立色から、実装では既存ゲームの金縁・暗色・日本語表示書体へ置き換えている。既存デザインシステムへ合わせるための意図した差分であり、情報階層と操作構造は維持されている。

## Required Fidelity Surfaces

- Fonts and typography: 既存ゲームUIの書体、太さ、文字間隔を継承。タブ、ラベル、補足、選択サマリーの階層が判別でき、折り返しや欠けはない。
- Spacing and layout rhythm: CPU名直下へアンカーされ、2列タブ、2列形状、3列サイズのリズムを維持。盤面やCPU画像との重なりはポップアップとして意図した範囲に収まる。
- Colors and visual tokens: 既存の暗色面、金色選択枠、淡色文字を使用。選択状態は色だけでなく枠と面でも判別できる。
- Image quality and asset fidelity: 新しい画像資産は不要。既存CPU画像と背景を変更せず、ポップアップのみ追加している。
- Copy and content: `CPU選択`、`盤面設定`、`盤面形状`、`盤面サイズ`、`偶数・正方形固定`、反映タイミング、選択中サマリーを確認。

## Interaction Verification

- CPU選択タブと盤面設定タブの切り替え
- CPUレベル選択後もポップアップを維持
- 通常 / 円形の切り替え
- 円形 12×12の選択とサマリー更新
- 画面外クリックによる閉じる操作
- 1280 × 720での収まり
- ブラウザコンソールエラーなし

## Comparison History

- Pass 1: ソース案と実装を同一状態で全面・局所比較。操作構造、情報階層、収まりにP0/P1/P2差分なし。既存ゲームテーマへの置換を意図した差分として確認。

## Follow-up Polish

- P3なし。

final result: passed
