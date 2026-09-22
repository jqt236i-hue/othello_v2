# カードリバーシ 物語接続サンプル

仮の会話から既存の戦闘を開き、勝敗で会話を分岐する Windows / TypeScript / Electron サンプルです。中断・再開、進行と結果受領の保存、同じ結果の重複受領防止を含みます。

## 実行

1. このフォルダーを独立した作業先へコピーする。
2. 元のゲームで `npm run build:battle-package`、`npm pack ./output/battle-package --pack-destination ./output` を実行する。
3. 生成された tgz を `vendor/` に置き、package.json のローカル依存のファイル名を合わせる。
4. `npm install`、`npm test`、`npm run build`、`npm start` を実行する。

Electron の実行ファイルが未取得なら `node node_modules/electron/install.js` を実行します。`npm run package` は `release/CardReversiStory/electron.exe` から起動する配布フォルダーを作ります。フォルダー全体が必要です。`electron.exe --smoke` は非表示で起動・戦闘開始・保存を検査し、`resources/app/smoke-result.json` と画面を出力して終了します。

`story.ts` が会話と戦闘条件、`storage.cjs` が進行保存、`main.cjs` がデスクトップと保存呼び出しの境界です。ゲーム本体のルールは tgz の公開 API から呼びます。元リポジトリへの実行時参照はありません。現在のサンプルは黒を人、白を CPU Lv1 としています。

## 保存と更新

通常保存先は Electron の userData 配下の `progress/` です。進行・結果受領 ID・戦闘 checkpoint を同じ保存世代へ確定します。最新世代が破損した場合は前の互換世代へ復旧し、将来版の保存は上書きせず拒否します。書き込み失敗時は成功した表示へ進みません。戦闘エラー時は最後の保存を保持して会話へ戻ります。

更新前に tgz と保存ディレクトリを保全します。別名の tgz を install し、package-lock の integrity、package 内の PACKAGE-MANIFEST の SHA-256 を記録します。型検査・保存互換・画面・オフライン配布を確認してから採用します。切り戻す際は新形式の保存を古いゲームで上書きしないでください。

## 配布前に残る判断

これは技術接続サンプルです。物語本文、署名、Steam 公開、実績・Cloud、コントローラー・Steam Deck 対応は含みません。Steam の実環境は未検証です。

同梱コードの依存物は battle package の THIRD-PARTY-NOTICES と Electron 配布物の LICENSE / LICENSES.chromium.html を参照します。画像・音声・フォント・モデルの出典と商用許諾は、そのコードの license から判断できません。PACKAGE-MANIFEST に列挙された素材を出典資料と照合してから販売版に採用してください。

テストは実際のファイルへの保存・破損復旧・将来版拒否と、実際の story.ts を読み込んだ読み込み競合・二重開始・異常終了を検証します。
