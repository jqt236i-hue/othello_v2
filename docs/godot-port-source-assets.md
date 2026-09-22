# Godot移植元の保存と素材台帳

この文書は移植準備の再生成・検証手順。対象は採用コード、実行時素材、既存CPUモデル、依存と利用条件文書。ゲーム仕様は [01-rulebook.md](../01-rulebook.md)、素材の申告元は [asset-provenance.md](asset-provenance.md) を正本とする。Godotのインポーターや新しいゲーム本体、権利の法的確定、追加学習は扱わない。

## 採用内容と開発途中の内容

開始時の正式コードは `bfd7ee626`（転生の意志追加）。移植準備による検証済み修正だけをこの版へ重ねる。開始時に存在したCPU Lv13、性能計測、制作素材、生成物の未コミット変更は、自動採用しない。最終成果物の **SOURCE-MANIFEST.json** にある `sourceCommit`、`adoptedOverlays`、各実ファイルのSHA-256が採用内容を識別する。`excludedWorkingTreeChanges` は書出し時の作業状況であり、その内容を収集したという意味ではない。

モデルはコミットに付随するとは推定しない。`--models-from` で指定した既存モデル保管元の `data/models/model-assets.json` と、その `files` に列挙された実ファイルだけを収集する。原本メタデータ、policy/value table、ONNXを同時に保存し、`externalModels` にサイズとハッシュを記録する。ONNXに対応する `.meta.json` がmanifestにない場合、空manifest、必要ファイル欠損の場合は失敗する。モデル付属メタデータは原本のまま保存するが、別ディレクトリの学習ログや候補モデルは対象外。

今回保全したモデルJSONは原本の改行もhashの一部である。通常のJSON向けGit改行変換を適用すると、別OSのcheckoutでmetadata hashが比較値と異なるため、`.gitattributes` の明示5パスだけを `-text` とした。重み・table・metadataの内容と元のバイト列を保持し、通常のソースJSONのLF統一は継続する。

`output/battle-package` は従来の組み込み配布物で、ここにあるだけでは最新版・正式採用版とみなさない。移植元は **新しい名前の `output/godot-source-*`** に作成する。途中失敗した収集物は `INCOMPLETE.json` を残し、正常完了の `SOURCE-MANIFEST.json` と区別する。既存の収集先への上書きは拒否する。

## 保存と再生成

依存を導入し、TypeScriptをビルドした後、採用済みコミットを指定する。以下の `<採用コミット>` は最終報告・manifestにある値へ置き換える。

```powershell
npm ci
npm run build:ts
node dist/scripts/godot-source-package.js export --ref <採用コミット> --models-from . --out output/godot-source-adopted
node dist/scripts/godot-source-package.js verify --out output/godot-source-adopted
```

コミット前の統合確認では、今回分のファイルを明示したJSON配列を `--overlay-files` に渡す。配列の各項目は文字列パス、または `{ "path": "...", "sha256": "..." }`。ハッシュ指定は選択後・収集中の同時編集を検出する。既存変更と同じファイルを共有する場合、今回分だけを反映した別ファイルを用意し、`{ "path": "package.json", "fromFile": "output/selection/package.json", "sha256": "..." }` と指定できる。これは元の作業ツリーを書き換えない。全dirtyを暗黙に採用するオプションはない。

```powershell
node dist/scripts/godot-source-package.js export --ref bfd7ee626 --overlay-files output/selection/adopted-files.json --models-from . --out output/godot-source-candidate
node dist/scripts/godot-source-package.js verify --out output/godot-source-candidate
```

保存はGitの選択コミットからblobを直接読み、普通のディレクトリへ書き出す。ブランチ・タグ・worktreeを作らず、index・未コミット変更・元素材を変更しない。実行中のゲームサーバーにも触れない。シンボリックリンク、未解決LFS pointer、相対パス逸脱、秘密ファイル、制作資料、学習ログは収集対象にできない。

| 出力 | 内容 |
| --- | --- |
| `SOURCE-MANIFEST.json` | 採用ref・overlay・モデル・環境・依存・生成条件・全収集ファイルのSHA-256/bytes |
| `source/` | 再ビルドできるコード・テスト・現行資料・元画像/音/フォント・採用モデル。`.godot-source.json` がGitのない配布用メタデータ |
| `ASSET-INVENTORY.json` | 実参照から得た素材パス、参照箇所、用途、ハッシュ、画像寸法/alpha、音量・loop、出典確認状態 |
| `runtime-assets/assets/` | 台帳の実行時素材だけ。Godotへ渡す元ファイル。画像や音を変換しない |
| `licenses/` | 素材申告、OFL、フォント生成metadata、直接・推移的実行時ライブラリの利用条件 |

`source/` には通常の実行時形式の元ファイルも残し、実参照のないものは台帳の `excludedUnreferenced` へ記録する。制作途中の `.blend` / `.psd` / `.kra` / `.bak`、`_reference/`、`archive/` は保存しない。`assets/asset-manifest.json` は既存の生成処理を使い、実参照へ絞って作り直す。日時は採用コミット時刻に固定する。

**hash検証は再生成前に実施する。** ビルドは `index.html` などの生成対象を更新するため、保管原本は残し、`source/` を別ディレクトリへコピーしてそこで再生成するのが保全用手順。下の簡略例のように `source/` を直接ビルドした場合、その後のhash差は元ソースの改ざんとビルド出力の更新を切り分ける必要がある。

Gitのない別環境でも `source/` で以下を実行できる。配布物の構築には既存の [build-battle-package.ts](../scripts/build-battle-package.ts) をそのまま利用し、同じ配布処理を重複実装しない。

```powershell
Set-Location output/godot-source-adopted/source
npm ci
npm run build:vite
node dist/scripts/build-battle-package.js
```

配布物はこの `source/output/battle-package`。`PACKAGE-MANIFEST.json` も採用refとoverlayを記録する。`npm ci` は同梱 `package-lock.json` の固定依存を使う。Node版・OS・CPUアーキテクチャと依存版は収集manifestへ記録される。Viteのハッシュ付きファイル名を他OSで同一と保証するものではなく、ルールの比較には対局比較データを用いる。リモートCI実行の成否はローカル再生成と別に報告する。

## 台帳の参照規則

[収集処理](../scripts/godot-source/assets.ts) は `cards/`、`shared/`、`game/`、`ui/`、`browser-vite/`、ルートCSS/HTML/音設定等から参照をたどる。TS正本があるJS shimは重複走査しない。直接の素材パスは `literal`、実行時に列挙する名前付きフォルダーは `dynamic-directory`、効果音ファイル名とbase pathの合成は `sound-config` と区別する。`dynamic-directory` は選択可能な素材プールであり、一対局で全部が使われたという主張ではない。

画像の寸法・形式・alpha channelは `sharp` で実ファイルから読む。`hasAlpha` はalpha channelの有無であり、全pixelの不透明度分布ではない。音は `sound-engine.ts` の初期設定を副作用なしで評価し、四則演算を含むloop時刻と音量を保存する。顕現BGMは `shared/special-card-registry.ts`、ガチャ音は `ui/gacha/gacha-reveal-audio.ts` の設定も記録する。実波形の音圧測定やブラウザの音声デコード結果はこの台帳の数値ではない。

| 音設定 | 引き継ぐ内容 |
| --- | --- |
| master | 初期値1、範囲0–2、muteを別途適用 |
| 効果音 | base 0.56 × key scale（既定0.35）× master、0–1へclamp。呼出し側volumeScaleで上書き可能 |
| BGM | 0.548625 × 0.24752 × master、0–1へclamp。playlist/顕現/敗北結果はloop、勝利結果は非loop |
| loopEndがnull | 音声デコード後のduration。明示loopEndは秒単位 |
| 特殊カード使用 | 通常BGM mute 3000ms。演出と音の再開条件は演出資料も参照 |

初期正式ソースの台帳検査で `ui/player-profile-avatar-options.ts` の究極多動神fallbackだけが欠損参照だった。`ULTIMATE_HYPERACTIVE_WILL-black.png` は存在せず、通常の描画経路が使う既存素材 `ULTIMATE_HYPERACTIVE_GOD-black.png` が正しいため修正する。新素材や演出変更ではない。これを直した正式ソースで **474件（画像382・音68・フォント24）** を確認し、全音素材に再生設定が対応した。最終成果物の正確な件数・採用内容はmanifest/台帳を確認する。

## 出典と利用条件の引き継ぎ

BGMは個人制作、画像はGPT画像生成、効果音の申告元はSpringin’ Sound Stock／イワシロ音楽素材。個別ファイルと申告の対応付けは未照合として記録し、音名から提供元を推測しない。BGMの申告を対応付けるのはplaylist・結果BGM・顕現BGMの用途が実装で確認できたものだけで、`assets/audio/other/gacha.mp3` は用途がガチャ音のため出典分類も未分類・未照合とする。[asset-provenance.md](asset-provenance.md) の日付・条件・注意をそのまま継承する。制作証拠の取得や権利の法的確定を収集成功の条件にしない。

フォントは元TTF、生成済みWOFF2、`assets/fonts/OFL.txt`、`font-build-manifest.json` を保全する。manifestはfontTools/Brotli版・source hash・メトリクス・subset条件を含む。再変換が必要なら `scripts/assets/build-font-assets.py` と `scripts/assets/requirements.txt` を利用し、元を上書きしない。

ライブラリのlicense/noticeは実際のインストール済み依存を再帰的に収集する。npm配布物に本文が欠けていたONNX Runtime 1.24.1、@pixi/colord 2.9.6は、同じ版の[ONNX Runtime LICENSE](https://github.com/microsoft/onnxruntime/blob/v1.24.1/LICENSE)、[第三者notice](https://github.com/microsoft/onnxruntime/blob/v1.24.1/ThirdPartyNotices.txt)、[colord LICENSE](https://github.com/pixijs/colord/blob/v2.9.6/LICENSE.md)を保存した。[sources.json](../scripts/godot-source/licenses/sources.json) が取得元と日付を記録する。

`guid-typescript@1.0.9` は配布package.jsonのISC宣言を保存したが、npm配布物と宣言されたupstreamの調査でlicense本文は未照合。noticeへ **LICENSE TEXT UNMATCHED** と明示し、著作権者や本文を捏造しない。これは移植準備の欠損隠蔽やライブラリ全体の権利確定を意味しない。未知の依存で本文が欠けた場合は収集を失敗させ、新しい不足を黙認しない。

## 検証

[scripts.godot-source-package.test.ts](../test/scripts.godot-source-package.test.ts) は、dirty保護、同一ファイルの明示分離採用、hash破損、欠損モデル、ONNX metadata欠損、path逸脱、制作資料除外、参照切れ、case mismatch、音量/loop計算、途中失敗の識別を検証する。

```powershell
npm run test:jest -- --runTestsByPath test/scripts.godot-source-package.test.ts
node dist/scripts/godot-source-package.js verify --out output/godot-source-adopted
```

検査が失敗した場合は `source:path`、モデル名、`hash mismatch` の対象を確認する。存在しない画像へダミーを置く、モデル欠損を推論成功へ読み替える、case mismatchをWindowsで読めるから無視する、古い配布物を成功扱いする、という対応はしない。Godotでのデコード・表示・音同期・CPU性能は実際の移植後に比較する。
