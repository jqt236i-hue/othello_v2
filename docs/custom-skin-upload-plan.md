# カスタムスキン画像読み込み実装計画

## 文書の役割

`docs/custom-skin-upload-design.md` を実装へ落とし込む計画書。対象は `背景`、`盤面デザイン`、`盤面フレーム`、`石` の個人用画像読み込み・保存・削除と、保存済み画像だけを集める `マイスキン` タブであり、サーバー公開ギャラリーやアカウント同期は対象外とする。

## 実装ステップ

### 1. 仕様と保存境界を確定する — 完了

- `01-rulebook.md` の見た目設定仕様へ、個人用カスタムスキンとネットワーク非共有のルールを追加する。
- 設計書を作成し、IndexedDB、動的カタログ、UI責務、非スコープを固定する。
- 検証: `git diff --check` と文書内の参照先確認。
- 完了条件: プレイヤー向け仕様と内部設計が同じ保存・共有範囲を示している。

### 2. カスタム画像ストレージと動的カタログを実装する — 完了

- `ui/custom-skin/storage.ts` を追加し、IndexedDB、Blob、object URL、メモリキャッシュ、更新イベントを実装する。
- background / board / stone の catalog がカスタム定義を一覧・ID解決できるようにする。
- 選択ID保存は既存 selection moduleを再利用する。
- 検証: storageの単体テスト、catalogの既存テストと追加テスト、typecheck。
- 完了条件: 保存済みレコードのhydrate後に各catalogがカスタム定義を返し、削除後に解決不能になる。

### 3. 見た目パネルの画像読み込みUIを実装する — 完了

- background / board / stone controllerへ作成エリアを追加する。
- `index.html` の対象一覧は既存のまま利用し、必要な入力はcontrollerが生成する。
- `styles-layout-info.css` に、既存の2列カード一覧と調和する作成エリア、プレビュー、状態表示、無効ボタンのスタイルを追加する。
- hydrate・保存・削除後の一覧更新と選択復元を接続する。
- 検証: UI controllerテストとブラウザ表示確認。
- 完了条件: 画像読み込み→プレビュー→保存→選択→削除が3対象で操作できる。

### 4. ブラウザ成果物を生成して統合検証する — 完了（ビジュアル基準差分あり）

- `npm run build:browser` で `dist/`、`public/module-registry.js`、indexのcachebusterを更新する。
- 必要に応じて `npm run worker:prepare` で生成ミラーの整合性を確認する。
- `npm run typecheck`、対象Jest、`git diff --check` を実行する。
- ローカル静的サーバーで、画像読み込み、再読み込み後の復元、削除、固定スキン削除不可を確認する。
- 完了条件: root source、生成ブラウザ成果物、テスト結果が一致し、関連する失敗がない。

ビジュアル回帰の `npm run test:visual` は2回とも、今回のエディタが表示されない初期盤面キャプチャで、基準 `372x372` に対して現行 `368x368` となる既存基準差分で失敗した。基準画像の更新や、今回の変更と無関係な盤面CSS変更は行わない。見た目パネルを開いた実機確認では、背景・盤面・石の編集UI、保存、再読み込み復元、削除を確認した。

### 5. 最終レビューとコミット — 完了

- `git status --short` と関連diffを確認し、タスク所有ファイルだけを対象にする。
- 既存変更がないこと、生成物が意図した差分だけであること、仕様書と実装が一致することを確認する。
- 短い具体的なコミットを作成する。
- 完了条件: 機能・検証・文書・コミットがそろい、残課題はサーバー同期を別機能として明記する。

## Completion checklist

- [x] 背景、盤面デザイン、石の画像読み込みUI
- [x] 保存・削除UIと固定スキン削除不可
- [x] IndexedDBへの個人保存と再読み込み復元
- [x] カスタムカタログと既存runtimeの接続
- [x] 入力形式・容量・名称・石2枚の検証
- [x] ネットワークへ画像データを流さない契約
- [x] `01-rulebook.md`、設計書、計画書の整合
- [x] focused Jest / typecheck / browser build / 手動ブラウザ確認
- [x] 最終diff確認とタスク所有ファイルのコミット

## 完了記録

- 実装コミット: `07faeec47 Add browser-local custom skin editor`
- `npm run typecheck`: 成功
- focused Jest: 5 suites / 43 tests 成功。依存境界チェックも成功
- `npm run build:browser`: 成功
- `npm run worker:prepare`: 成功（827 files mirror-verified）
- `npm run check:window`: 成功
- Playwright実機確認: 背景・盤面・石の画像読み込み、保存、再読み込み復元、削除を確認
- 残存事項: `npm run test:visual` は既存の基準画像サイズ差分（基準372px / 現行368px）で失敗。今回のエディタが表示されない初期盤面キャプチャのため、基準更新は保留

## Self-review

- ストレージ先をlocalStorageにせずIndexedDBにしたことで、画像ファイルを個人保存する要求と容量制約を両立できる。
- 実装順をストレージ→カタログ→controller UI→生成物・ブラウザ検証としたため、同期APIを壊さずにUIを接続できる。
- `index.html`へ大量の固定UIを追加せずcontroller生成に寄せるため、既存の見た目パネル構造を維持できる。
- 仕様・設計・計画でサーバー保存を非スコープとして明記し、公開URLの意味を個人ブラウザ内利用に限定した。

見直しの結果、追加の計画変更は不要と判断した。

## 追加要件: マイスキンと一時使用

### 実装内容

- [x] 保存済みカスタムスキンだけを表示する `マイスキン` タブを追加
- [x] 背景・盤面デザイン・石を種別ごとにまとめ、各カードへ `使用` / `保存` / `削除` を追加
- [x] `使用` は既存カテゴリのruntimeだけを呼び、選択IDを保存しない
- [x] `保存` は既存カテゴリの選択保存経路を呼び、次回起動用の選択を更新する
- [x] `削除` はIndexedDBの個人スキンレコードを削除し、一覧とカテゴリ一覧を更新する
- [x] タブ切替時・保存更新時・削除時に現在使用中表示と保存済み一覧を再描画する

### 追加検証

- `npm run typecheck`: 成功
- focused Jest: 4 suites / 35 tests 成功
- `npm run build:browser`: 成功。browser module registry と cachebusterを更新
- `npm run worker:prepare`: 成功。Worker mirror 828 files verified
- `npm run check:window`: 成功
- `npm run check:dependency-boundaries`: 成功
- Playwright実機確認: `マイスキン` タブ、保存済みカード、`使用` の非永続適用、`保存` の永続化、`削除` を確認
- `npm run test:visual`: 既存の初期盤面基準画像サイズ差分（基準372px / 現行368px）で失敗。`マイスキン` パネルは初期キャプチャ対象外のため基準画像は変更していない

### 完了記録

- 追加実装: `ui/custom-skin/my-skin-controller.ts`、カテゴリcontrollerの一時使用・保存API、見た目パネルの `マイスキン` タブ
- 生成物: `public/` と `worker-public/` を更新
- 実機確認ではテスト用スキンを作成後に削除し、テストデータを残していない

## 追加修正: 作成エリアの使用ボタン

- [x] 背景・盤面デザイン・石の作成エリアにも `使用` を表示
- [x] 保存済みカスタムスキン選択時だけ `使用` を有効化
- [x] `使用` は既存カテゴリの非永続APIを呼び、選択IDを変更しない
- [x] focused Jest とブラウザ実機で3ボタン表示と非永続適用を確認

## 追加要件: 盤面フレーム画像

- [x] IndexedDBとカタログに `board-frame` の画像レコードを追加
- [x] 盤面フレームタブへ既存の画像エディタと同じ `使用` / `保存` / `削除` を接続
- [x] `マイスキン` に保存済み盤面フレームを表示し、フレームruntimeと選択保存へ接続
- [x] 既存フレームのレイアウト値を維持し、カスタム画像では画像だけを差し替える
