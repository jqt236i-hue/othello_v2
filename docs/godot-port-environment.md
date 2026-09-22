# 移植準備の再生成環境

役割: 移植元を生成・検査する運用資料。対象はJavaScript版の比較基盤と配布物。ルールは [01-rulebook.md](../01-rulebook.md)、内部契約は [architecture-contracts.md](architecture-contracts.md)。Godot側の実装・速度保証・本番公開を扱わない。

## 対応環境

2026-09-22確認。Node.js 24 LTSを採用し `.node-version` とGitHub Actionsを24へ揃えた。Node.js公式で24/22はLTS、旧CIの20はEOL。[Node.js公式リリース表](https://nodejs.org/en/about/previous-releases)。この作業のローカル実測はWindows、Node **24.12.0**、npm **11.6.2**。再現時の正確な版は出力manifestにも保存する。

`package-lock.json` を依存解決の基準に `npm ci` を使う。ローカル導入済みVite 8.1.4のengineは `^20.19.0 || >=22.12.0`、Playwright 1.57.0は `>=18`。Node 24は両方を満たす。[Vite公式環境要件](https://vite.dev/guide/)。依存の最新版への更新は今回行わない。

ブラウザ実行前に `npx playwright install --with-deps chromium`（Windowsでは必要なChromiumを導入）を実行する。npm導入だけではブラウザ実体が保証されない。[Playwright公式CI手順](https://playwright.dev/docs/ci)。既存Jest jobのブラウザ導入不足を修正した。

## 新しい環境

1. 採用ソースを展開する。dirtyな開発ツリーではなく [保存手順](godot-port-source-assets.md) の採用パッケージとmanifestを使用する。
2. Node 24とnpmを用意し `npm ci`、`npx playwright install --with-deps chromium` を実行する。
3. `npm run typecheck`、`npm run build:vite`。この生成は正本から `dist/`、ブラウザ入口、Vite資産を作る。
4. `node dist/scripts/godot-conformance.js check` と `node dist/scripts/godot-cpu-benchmark.js check`。失敗はcase/step/pathまたは差分として表示する。旧fixtureを書き換えて合格させない。
5. `node dist/scripts/godot-cpu-benchmark.js models output/godot-check/cpu-models.json` で実ONNX推論を確認する。欠損モデルは失敗であり、fallback成功として扱わない。出力先は新規ファイルを指定する。
6. `node dist/scripts/build-battle-package.js` で配布物を生成する。モデル・画像・音・フォント・licenseを含む完全配布物が必要。過去の `output/battle-package` の存在だけを完成証拠にしない。
7. 通常のローカル画面は既存8000サーバーを確認して `npm run serve`。[演出・ライフサイクル検証](godot-port-presentation-lifecycle.md) のコマンドで画像・動画・音声・時系列を生成する。

実行時モデルは既存の `data/models/model-assets.json` が列挙する7ファイルとメタデータだけを保全する。学習用checkpoint、候補モデル、訓練ログは含めない。モデルの再学習は既存モデルの再現方法ではない。元の重みと特徴量順を使う。

## CIとローカルの区別

`.github/workflows/node-test.yml` はNode 24、ブラウザ導入、完全配布物生成、ルール比較、CPU固定探索量比較、実モデル推論と成果物保存を定義する。モデルをGitから除外していた状態ではクリーン環境の配布物が不完全になるため、実行時manifestの限定リストだけを今回保全した。

この作業ではリモートCIを起動していない。ローカルでの型・テスト・生成・ブラウザの結果は [完了記録](godot-port-preparation.md) を参照。Linux CIの実行成功、Godotでの挙動・速度、コンソールやSteam Deckへの対応は未検証。
