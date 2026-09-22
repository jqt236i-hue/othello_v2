# Godot移植準備の入口と検証記録

役割: 移植準備の成果物・採用範囲・検証結果の入口。対象は既存JavaScript版の対局基盤、設計、CPU、素材、演出。ゲーム仕様の正本は [01-rulebook.md](../01-rulebook.md)、詳細は [正本](../正本/AGENTS.md)、内部責務は [architecture-contracts.md](architecture-contracts.md)。Godot版の開発・再現検証・性能保証は含まない。

## 引き継ぐ成果物

| 準備 | 入口 | 完了の判定材料 |
| --- | --- | --- |
| 新カード後の回帰・歴史基準 | [データ契約と互換性](godot-port-data-contract.md) | 旧fixtureを保管し適用版を分離。現在版save/replayと互換テスト |
| 再現可能な採用元 | [ソース・素材の収集](godot-port-source-assets.md) | 採用commit＋明示overlay＋全実ファイルSHA-256＋モデル原本 |
| ゲーム設計とルール | [全100カード対応表](godot-port-rules.md) | 正本・実装・検証・演出の対応、処理順・寿命・保護・盤形状 |
| 言語非依存JSON | [データ契約](godot-port-data-contract.md) | schema出力、正常/異常JSON、設定/保存/状態/操作/遷移/結果/event検証 |
| 自動比較 | [決定論比較](godot-port-conformance.md) | 206ケース671手順、全状態・イベント・結果、差のcase/step/path |
| 乱数・保存・互換 | [比較vectors](../test/fixtures/godot-conformance/vectors.json)、[保存テスト](../test/battle.data-contract.test.ts) | PRNG/shuffle/UTF-16 hash正解例、異常拒否、671状態の保存検証 |
| 演出・音・画面 | [演出と証拠](godot-port-presentation-lifecycle.md) | 実入力、動画・音声・同期動画・PNG・event時系列 |
| 戦闘ライフサイクル | [退出・再開・結果契約](godot-port-presentation-lifecycle.md) | CPU/演出中の保存・退出、pending再開、遅延結果破棄、報酬重複防止 |
| CPU | [CPU仕様と比較](godot-port-cpu.md) | 固定128遷移×3局面×Lv10–12、モデル実推論、別建ての100ms計測 |
| 素材・license | [収集台帳](godot-port-source-assets.md) | 実参照474素材、画像寸法/alpha、音gain/loop、欠損/case検査、出典確認状態 |
| 再生成・CI | [環境とコマンド](godot-port-environment.md) | Node24、lockfile、Chromium導入、配布物と比較CI、独立レビュー |

## 採用境界

開始HEADは `bfd7ee626`。移植準備の検証済み変更だけを重ね、移植元のmanifestへ列挙する。開始時にあったCPU Lv13、性能改善、素材制作・整理、既存生成物差分は元の作業ツリーに残し、正式採用へ暗黙に含めない。[実行計画](godot-port-preparation-plan.md) に開始時記録と担当境界を残した。

実行時モデルはGit管理外だったため、既存の配信manifestが指定する7ファイル約70.2MBとmanifestを今回保全する。候補モデル・学習checkpoint・巨大ログは追加しない。通常配信のdirtyな開発ツリーと、採用パッケージの再生成結果は区別する。

## 修正の根拠

- **旧比較の適用範囲**: 転生の意志追加で標準デッキの候補とshuffleの乱数消費が変化した。旧版の期待hashを新版へ無条件適用するテスト前提を修正。歴史fixtureの中身は変更せず、旧content版は拒否する。現在版のfull state/event/save基準を別ファイルへ追加。
- **表示とルールの識別**: 名前・説明等だけでセーブ互換が壊れないようsemantic内容識別へ分離。知っている直前の内容hashだけを固定移行し、未知版や旧ルールを一般許可しない。
- **派生カードの保存拒否**: `enabled:false` は初期デッキ対象外の意味であり、ゲーム中に生成される派生カードは合法。保存のカードID検証を全runtime定義へ合わせ、初期デッキの制約は維持。
- **最後に使ったカードの情報**: ブラウザのカード入力層が正本のIDを表示用objectへ上書きしていた。pipelineが確定したIDを維持し、UIはcatalogから表示を解決する。
- **使用済みカード欄の空表示**: 転生の意志・ゾンビの意志・意志の凍結・毒殺の意志・混沌召喚の説明登録が漏れていた。正本に沿う要約を登録し、全100カードの登録検査と転生の実表示で確認した。
- **転生の音同期**: Pixi tickerの上限付きdeltaを積算すると、遅いframeが続いた時に音より表示確定が遅れた。転生の2区間だけ単調実時間へ追従させ、仕様の2500ms＋1800msは変更しない。低FPSの回帰と実録画で確認した。
- **保存の検証不足**: 効果名、marker、counter、ID参照、盤形状、pending等の不正値を拒否。正常な全671比較状態と保存往復を併せて確認し、合法状態を狭めない。
- **画像参照切れ**: 究極多動神のプロフィール画像fallback名が実ファイルと異なった。存在する `ULTIMATE_HYPERACTIVE_GOD-black.png` へ修正し、全fallbackの存在を検査。
- **再生成不足**: 配布物のモデル欠損を黙認しない。採用元・実素材・依存licenseを明示収集し、旧outputを自動採用しない。CIのNode20とChromium未導入を修正。

## 最終検証

2026-09-22、Windows / Node 24.12.0で以下を確認した。生ログと画像・動画は `output/godot-port-preparation/` に保存する。これらは再生成できるローカル出力でありGitへ含めず、比較fixture・生成処理・採用モデル・資料をコミットする。

| 確認 | 結果 / 証拠 |
| --- | --- |
| 型・全体の静的検査 | `npm run typecheck`、`npm run checkall` 成功。`typecheck-final-code.log`、`checkall-final.log` |
| 保存・カード・描画・CPU連携 | 保存系5suite59件、生成/比較4suite23件、描画/CPU連携9suite138件成功。その後の保存互換・低FPS・検査修正は5suite86件を再実行して成功。全100カード説明検査1件も成功。`tests-save.log`、`tests-tooling.log`、`tests-lifecycle.log`、`tests-final-fixes.log`、`tests-last-used-copy.log`（重複を含むため合算しない） |
| 言語非依存の比較 | 206ケース671手順、全100カード、状態/event/resultの差分0。採用ソースの別ディレクトリでも再生成・比較成功。`rebuild-comparison-complete.log` |
| 公開JSON | schemaを出力し、CLIで正常/異常9例を期待どおり受理/拒否。`data-contract.json`、`data-contract-cli-report.json` |
| CPU | 固定128遷移のgoldenと再実行一致。実WASM/ONNX出力比較成功。別建て100ms予算の短時間測定。`cpu-check.log`、`cpu-models-final.json` とCPU資料 |
| 採用ソース再構築 | 元ツリーと別の `output/godot-source-rebuild-final/source/` で `npm ci`、Vite build、既存配布処理が成功。987ファイルの配布物を生成。`rebuild-install.log`、`rebuild-vite-complete.log`、`rebuild-package-complete.log` |
| 配布物の実ブラウザ | `http://127.0.0.1:8000/output/godot-source-rebuild-final/source/output/battle-package/browser/` のVite/PixiとDOM compatibilityで通常クリック→保存→新document復元成功。黒勝/白勝/引分とLv6の実ONNX推論4回も成功。`packaged-browser-complete.log`、`output/battle-verification/browser-report.json` |
| 通常配信の演出・寿命 | `http://127.0.0.1:8000/?battleEmbed=1&debug=1&boardRenderer=pixi`、Vite/Pixi、演出有効。転生・破壊、実音声トラック、保存待機、CPU待機中退出、pending復元、演出中退出に成功。[report.json](../output/godot-port-preparation/presentation/report.json) と [詳細](godot-port-presentation-lifecycle.md)。転生確定は音開始から2532.7ms |
| 最終配信・mirror | `npm run worker:prepare`（`build:vite`を含む）成功、1112ファイル一致。`worker-prepare-complete-final.log`。8000はこのrepoの `npm run serve` と独立したhiddenプロセスで継続、HTTP 200とゲーム操作を別々に確認 |

採用ソースの保管先は `output/godot-source-adopted-20260922-final/`。`SOURCE-MANIFEST.json` の `sourceCommit` が今回のコミットを指し、`files` と `ASSET-INVENTORY.json` が実ファイルを特定する。保管原本はビルドせず、検証後にコピーを再生成に使う。途中の `godot-source-candidate-*`、`godot-source-baseline-*`、改行保全前の `godot-source-adopted-20260922/` と古い `output/battle-package` は最終採用元ではない。

最終Git blob照合でモデルJSON5ファイルが改行変換されることを検出し、該当パスだけ元のバイト列を保つ属性を設定した。全モデル8ファイルを実checkoutと原本でhash照合し、checkoutした実モデルでも推論比較を確認した。モデルの更新や学習は行っていない。

## 独立レビュー

実装担当外のレビューで、選択途中の保存項目欠落、`*_reference` 制作資料の収集混入、ガチャ音の出典推定の3件を検出し、修正・回帰検証した。既知旧UIセーブの厳密な移行、生成mirror検査、保存ソースの検査除外、音同期、5カードの表示文も追加レビュー済み。最終の実ブラウザ証拠・採用内容・コミット差分を照合し、未解消の指摘はない。

通常ツリーには開始時のCPU Lv13・性能改善・素材制作/整理とその生成結果を残す。共有 `package.json` と生成物は採用版の内容だけをステージするため、コミット後も開発ツリーとの差分が残る。別作業を一括採用・巻き戻ししていない。

## 範囲外と確認状態

Godotのゲーム本体は未作成で、Godotでの同一挙動・速度・画像・音の再現は未検証。リモートGitHub Actionsも未実行。演出の証拠は代表場面であり全カード全frameの録画ではない。素材出典の個別未照合とフォント・依存licenseの確認状態は台帳へ記録し、法的な権利確定と混同しない。元の素材・CPU開発作業を破棄・正式採用していない。
