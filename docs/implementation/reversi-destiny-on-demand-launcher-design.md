# 2Dアクション オンデマンド起動導線 設計書

## 1. 文書の役割

- 状態: 実装前・セルフレビュー済み
- 対象: カードリバーシから `Reversi Destiny ～黒白の運命～` を任意起動できる導線
- プレイヤー向け表示の正本: `01-rulebook.md`
- カードリバーシの内部境界の正本: `docs/architecture-contracts.md`
- 2Dアクションの正本:
  - `C:\Users\quarr\Documents\2Dアクション\docs\game-contract.md`
  - `C:\Users\quarr\Documents\2Dアクション\src\`
- 本書の役割: 両ゲームを混ぜず、カードリバーシ起動時に2Dアクションを読み込まず、公開URLからクリック時だけ開くための実装判断を固定する

本書はゲームルールの正本ではなく、製品実装や公開作業そのものも行わない。

## 2. 問題と望ましい結果

ユーザーは自作の2Dアクションをカードリバーシから開けるようにしたい。ただし、次の条件がある。

1. カードリバーシ起動時には2Dアクションをロードしない。
2. プレイヤーが `2Dアクション` を押した時だけロードする。
3. ローカル専用ではなく公開URLでも動作する。
4. カードリバーシのゲーム進行、CPU、カード、盤面、ネット対戦ロジックを汚さない。

望ましい結果は、カードリバーシの左メニューに `2Dアクション` 導線が増え、そのリンクを押した時だけ、独立公開された2Dアクションが新しいタブで起動することである。カードリバーシと2Dアクションは、コード、状態、アセット、音声、WebGLコンテキスト、公開物を共有しない。

## 3. スコープ

### 3.1 含む

- 2Dアクションを独立した静的WebアプリとしてHTTPS公開する。
- カードリバーシの左メニューへ、独立公開URLを別タブで開くリンクを追加する。
- リンクを既存メニューと同じ見た目、レスポンシブ挙動、アクセシビリティで表示する。
- カードリバーシ初期起動時に2Dアクション公開先への通信が一件もないことを検証する。
- クリック後に新しいタブが開き、2Dアクションのタイトル画面とPhaser canvasが動作することを検証する。
- 両リポジトリの仕様、運用文書、生成物を正しい順序で同期する。

### 3.2 含まない

- 2DアクションをカードリバーシのJavaScript bundleへimportすること。
- 2Dアクションの約49 MBの配信物をカードリバーシの `worker-public/` へ複製すること。
- カードリバーシ画面内の `iframe`、モーダル、同一タブ置換。
- 両ゲーム間のセーブ、プロフィール、ランキング、BGM、入力、対局状態の連携。
- 2Dアクション起動時にカードリバーシの対局、AUTO、ネット接続、音声を停止・変更すること。
- 2Dアクションのゲーム内容、操作、難易度、ステージ、保存schemaの変更。

## 4. 前提と制約

1. カードリバーシの表示文書の編集元は `index.classic.html` であり、`index.vite.html` と `index.html` は既存生成手順に従う。
2. ブラウザ表示に影響するroot変更後は `npm run build:browser` が必須であり、公開経路の確認には `npm run build:vite` と `npm run worker:prepare` が必要になる。
3. カードリバーシの `game/`、`shared/`、CPU、Worker authorityにはDOM・外部URL・別ゲームの概念を入れない。
4. 2Dアクションは `vite.config.ts` で `base: './'` を使用しており、独立ドメインやサブパスの静的配信に適合している。
5. 2Dアクションの `dist/` は生成物であり、直接編集しない。
6. 2Dアクションの現在のGitリポジトリにはHEADがなく、全ソースが未追跡である。公開時は、検証したsource/build identityと公開成果物の対応を記録し、別のbuildを取り違えない。
7. 外部サービスへの公開は状態変更であるため、実装担当は実行直前にユーザーの明示承認を得る。

## 5. 現状とリポジトリ根拠

### 5.1 カードリバーシ

- `index.classic.html` の `#leftActionButtons` がCPU、ネット対戦、レート戦、ランキング等の固定導線を所有する。
- `scripts/build-vite-entry.ts` は `index.classic.html` の文書shellを維持し、Vite entryを生成する。
- `vite.config.ts` は `publicDir: false` で、Vite成果物を `vite-dist/` に生成する。任意の別アプリ配信物を自動同梱する構造ではない。
- `scripts/prepare-worker-assets.ts` は列挙されたrootファイルとディレクトリを `worker-public/` へミラーする。
- `worker-public/` は現時点で約918ファイルを追跡している。別ゲームの配信物を足すと生成ミラーとGit差分が大幅に増える。
- `docs/architecture-contracts.md` §5.1.1 は、任意機能の失敗やロード状態をcanonical game stateへ入れないことを要求している。

### 5.2 2Dアクション

- `package.json` は TypeScript / Phaser 3 / Vite / Vitest の独立アプリを定義する。
- `src/main.ts` は独自の `Phaser.Game`、UI、音声、保存storeを生成する。
- `vite.config.ts` は `base: './'`、`dist/` 静的成果物、content-hashed chunkを使用する。
- 現在の `dist/` は約48,921,336 bytesで、`build-identity.json` を含み、HTML上のproduct file countは425である。
- 初期JavaScript chunkだけでも約1,335,173 bytesあり、カードリバーシbundleへ統合すべき小さな任意モジュールではない。
- 2Dアクションの保存キーは `reversi-destiny-*` で名前空間化されているが、別オリジン公開ならカードリバーシのlocalStorageからも完全に分離される。

## 6. 比較した方式

| 方式 | 初期ロード | 既存ロジック分離 | 公開運用 | 主な問題 | 判定 |
| --- | --- | --- | --- | --- | --- |
| Phaser/2Dソースをカードbundleへ直接import | bundler解析・共有依存が増える | 弱い | 1配信 | グローバル、CSS、音声、WebGL、依存を混在させる | 不採用 |
| 2D `dist/` を `worker-public/` へ同梱 | クライアント通信は遅延可能 | 中 | 1配信 | 約49 MB・425ファイルをカード側ミラーとGitへ重複させる | 不採用 |
| 外部公開URLをカード内 `iframe` へ遅延設定 | クリックまでゼロにできる | 中 | 2配信 | Pixi/Phaser同時稼働、BGM、対局継続、CSP、閉じる処理が必要 | 将来候補 |
| 独立公開URLを通常リンクで別タブ起動 | クリックまでゼロ | 強い | 2配信 | タブが分かれる | **採用** |

採用方式は、今回の最優先条件である「カードリバーシの既存ロジックを汚さない」を最も強く満たす。画面内埋め込みは将来追加できるが、初回実装の必要条件にはしない。

## 7. 選択設計

### 7.1 所有境界

```text
カードリバーシ公開URL
  └─ index.classic.html の通常リンク
       └─ プレイヤーのclick
            └─ 新しいトップレベルタブ
                 └─ 2Dアクション公開URL
                      └─ 独立したHTML / Phaser / assets / storage
```

- カードリバーシは「公開URLへの導線」だけを所有する。
- 2Dアクションは自身のbuild、配信、Phaser runtime、アセット、セーブを所有する。
- 両者間にimport、DI、`postMessage`、window参照、共有global、共有localStorage keyを設けない。
- 2Dアクションはカードリバーシのoptional Vite groupやmodule registryへ登録しない。

### 7.2 UI契約

`index.classic.html` の `#leftActionButtons` に、既存ボタンと同じ視覚クラスを使う実リンクを追加する。

リンクの契約は次の通り。

- 表示名: `2Dアクション`
- 補助表現: 外部・別タブであることが分かるアイコンまたは `↗`
- 要素: JavaScript疑似ボタンではなく `<a>`
- `target="_blank"`
- `rel` は少なくとも `noopener noreferrer external`
- `referrerpolicy="no-referrer"`
- `aria-label`: `2Dアクションを別タブで開く`
- `href`: 2Dアクションを公開した工程で確定した安定HTTPS URL

リンクは `CPU` / `ネット対戦` 等の対局モード切替ではない。選択中表示、`aria-expanded`、ゲームモードstate、AUTO、network clientには接続しない。

既存railの高さが増えるため、デスクトップ、狭い横画面、モバイル相当幅で全導線と `非表示` ボタンが操作可能であることを確認する。必要なCSS調整はrailの表示責務内に限定し、盤面レイアウトやゲーム座標を変更しない。

### 7.3 ロード契約

カードリバーシの初期HTMLにはリンク文字列だけを含める。次を禁止する。

- `<iframe src="...">`
- `<link rel="preload">`
- `<link rel="modulepreload">`
- `<link rel="prefetch">`
- `<link rel="preconnect">`
- `<link rel="dns-prefetch">`
- 起動時 `fetch` / `HEAD`
- 2Dアクションのscript、stylesheet、image、audioの参照
- 2Dアクション公開先を読み込むdynamic import

したがって、カードリバーシのアプリケーションは起動時に2Dアクション公開先へのHTTP requestを開始せず、HTML、JS、CSS、画像、音声を取得しない。ブラウザ自身のnetwork predictionはアプリケーションから制御できないため保証対象にせず、プレイヤーの実クリックによる新しいタブのnavigationを唯一のアプリケーション上のロード開始点とする。

### 7.4 タブとゲーム進行

別タブを開いても、元のカードリバーシタブは終了・一時停止・設定変更しない。これにより、カードのcanonical stateやネット接続を別ゲーム起動導線が所有しない。

その結果、カードリバーシでAUTOやネット対戦が進行中なら、元タブ側は継続し得る。リンクのtitleまたは補助説明で「別タブで開く・カードリバーシは継続」と明示する。カードリバーシ自体を一時停止する要件が追加された場合は、今回の導線へ暗黙に混ぜず、ゲームモード別の停止可否を別設計する。

### 7.5 公開契約

2Dアクションはカードリバーシとは別の安定HTTPS URLで静的配信する。初回実装の推奨先は、既存のCloudflare運用と合わせやすい独立Cloudflare Pagesプロジェクトである。

公開成果物は2Dアクションの `npm run build` が生成した `dist/` だけとし、次を満たす。

- `/` または公開サブパスのHTMLが200。
- content-hashed JS/CSSが正しいMIME typeで200。
- `assets/reversi-destiny/` の代表画像・音声が200。
- HTMLは再検証、hash付きJS/CSSは長期immutable cacheを基本とする。
- `vite.config.ts` の `base: './'` を維持し、配信階層に依存しない。
- 公開URLと公開手順を2Dアクションの `README.md` に記録する。
- `dist/build-identity.json` とHTML埋め込みidentityが、公開したbuildと一致する。

カードリバーシ側は外部URLへのトップレベルnavigationだけなので、`frame-src`、`frame-ancestors`、`X-Frame-Options`、cross-origin messagingの変更を必要としない。

### 7.6 URL変更

公開URLはプレイヤー向け導線であり、最初の公開工程で確定した安定URLを `index.classic.html` の `href` に記録する。URL抽象化や別catalogは、複数の同種ゲームを扱う要件がない限り追加しない。

URLを変更する場合は、正本HTMLを変更して既存のbrowser生成・Worker mirror手順を再実行する。生成済み `index.html`、`index.vite.html`、`worker-public/` を先に編集しない。

## 8. エラー、境界条件、互換性

### 8.1 公開先が停止・オフライン

通常のリンクnavigation失敗として新しいタブ側に閉じ込める。カードリバーシ側は状態を変更せず、エラーを成功として見せる独自fallbackも追加しない。

起動前の到達確認は行わない。到達確認のためのstartup requestは「カード起動時にロードしない」という契約を弱めるためである。

### 8.2 ポップアップ制限

実クリックされた通常の `<a target="_blank">` を使用し、非同期callbackから `window.open` しない。これにより一般的なpopup blockerの対象になりにくい。

### 8.3 JavaScript無効

実リンクであるため、カードリバーシのJavaScriptが起動しない場合でも導線自体は機能できる。これは追加のfallback codeを必要としない。

### 8.4 タッチ・キーボード・支援技術

- Tabで到達し、Enterで起動できる。
- focus outlineを既存ボタン同等以上に保つ。
- 別タブであることをaccessible nameまたは補助テキストで伝える。
- モバイルで長いラベルが切れず、railの `非表示` 操作を押し出さない。

### 8.5 セキュリティ

- HTTPS URLだけを採用する。
- `noopener` で2Dアクション側から `window.opener` を操作できないようにする。
- `noreferrer` / `referrerpolicy="no-referrer"` でカードリバーシURLやqueryを別アプリへ渡さない。
- query、seat token、room ID、player ID、profileをリンクへ付加しない。

## 9. 仕様・生成・運用への影響

### 9.1 カードリバーシ

- `01-rulebook.md`: 左メニューの `2Dアクション`、別タブ起動、カード側継続、オンデマンドロードをプレイヤー向け仕様へ追加する。
- `docs/architecture-contracts.md`: companion appは独立公開・top-level navigationのみであり、browser module graphやcanonical stateへ入れない安定境界を追記する。
- `正本/*.md`: カード効果、ターン、盤面、演出、音声仕様を変更しないため更新しない。
- `index.classic.html`: リンクの唯一のHTML編集元。
- `styles-layout-controls.css`: link reset、専用icon/tone、必要最小限のrail responsive調整。
- `index.vite.html` / `index.html`: `npm run build:vite` による生成。
- `worker-public/`: `npm run worker:prepare` によるmirror。2Dアクションの配信物は含めない。

### 9.2 2Dアクション

- `README.md`: 本番URL、公開手順、build identity確認、カードリバーシから別タブ起動されることを追記する。
- ゲーム契約、simulation、Phaser scene、assets manifestは変更しない。
- `dist/` は通常buildで再生成し、sourceとして編集・commitしない。

## 10. 検証戦略

### 10.1 カードリバーシのfocused検証

1. HTML契約test:
   - 正本 `index.classic.html` にリンクが一つだけある。
   - `target`、`rel`、`referrerpolicy`、accessible name、HTTPS `href` が正しい。
   - URLが2Dアクションのscript/style/preloadとして現れない。
2. Vite entry test:
   - `scripts/build-vite-entry.ts` がリンクを `index.vite.html` へ保持する。
3. UI layout確認:
   - desktop、狭い横画面、mobile相当でrailが操作可能。
   - collapse後は既存契約通り導線が隠れ、再表示できる。
4. browser request確認:
   - Card readyまで2Dアクションoriginへのrequestが0。
   - リンク実クリックで新しいPageが一つ開く。
   - 元のCard page URL・mode・ready stateが変わらない。

### 10.2 2Dアクションの検証

- `npm test`
- `npm run typecheck`
- `npm run build`
- 2DリポジトリのAGENTSに従い、dev/previewを同時起動せず、previewで次を確認する。
  - HTML、代表JS、代表画像が200。
  - Phaser canvasが存在し、0でないサイズ。
  - タイトル画面と21ステージ導線が見える。
  - console warning/errorが0。

### 10.3 公開URLの結合確認

- カードリバーシ公開URLを新しいbrowser contextで開く。
- readyまで2Dアクション公開originのrequestが0。
- `2Dアクション` を押して新しいタブが開く。
- 2Dアクション公開URL、canvas、タイトル画面、代表asset、consoleを確認する。
- 元のカードリバーシタブへ戻り、盤面・入力・ネットUIが壊れていないことを確認する。

### 10.4 カードリバーシのbuild・mirror確認

- focused Jest
- `npm run build:browser`
- `npm run build:vite`
- `npm run worker:prepare`
- `npm run check:worker-mirror`
- `npm run match:production-delivery-smoke:vite`
- `git diff --check`

公開時は両公開URLのreal-operation smokeを必須とする。

## 11. リスクと緩和

| リスク | 影響 | 緩和 |
| --- | --- | --- |
| 2Dアクションの公開URLが変わる | カード側リンク切れ | 安定URLを採用し、URL変更時は正本HTMLから再生成・再公開 |
| 別タブ中もカード対局が継続する | 戻った時に局面が進んでいる | 導線に継続を明記し、停止は別仕様として扱う |
| railに1項目増えて狭い画面で切れる | 導線や非表示ボタンを押せない | viewport別browser確認とrail内だけのresponsive調整 |
| startup時に外部先を確認してしまう | ゼロロード契約違反 | preconnect/prefetch/fetchを禁止し、network request testで固定 |
| 2Dアクションの未追跡sourceとbuildを取り違える | 公開物の再現性低下 | test/build後のbuild identityと公開物identityを照合・記録 |
| 外部タブから元タブを操作される | セキュリティ・状態汚染 | `noopener noreferrer`、state/token非送信 |

## 12. 完了条件

- カードリバーシの左メニューに `2Dアクション` が表示される。
- 導線が2Dアクションの安定HTTPS URLを別タブで開く。
- カードリバーシreadyまで2Dアクションoriginへの通信が0件。
- クリック後だけ2DアクションHTML/JS/CSS/assetsが要求される。
- 公開先で2DアクションのPhaser canvas、タイトル、代表assetが正常。
- 元のカードリバーシタブはnavigationせず、game/network/canonical stateを導線が変更しない。
- `game/`、`shared/`、CPU、network authority、module registryに2Dアクション依存がない。
- 2Dアクション配信物がカードリバーシの `worker-public/` に複製されていない。
- 正本、README、生成HTML、Worker mirrorが既存手順で同期している。
- 両リポジトリの検証結果、公開URL、build identityが記録されている。

## 13. Self-review

### 確認した問題

1. 初案の `iframe` はオンデマンドロード自体は満たすが、PixiとPhaserの同時稼働、音声、対局継続、CSP、破棄処理をカード側へ持ち込む。
2. 同一Workerへの成果物同梱は、約49 MB・425ファイルをカード側の生成mirrorとGitへ加える。
3. 単なる外部リンクでも、起動前到達確認やpreconnectを入れると「起動時にロードしない」を厳密には弱める。
4. 別タブ起動ではカード側が継続することをプレイヤーへ説明しないと、AUTO/ネット対戦時に驚きが生じる。
5. 2Dアクションは現在Git HEADを持たないため、公開物のidentity確認を明示する必要がある。

### 修正

- 正案を独立公開URLへのnative linkに固定し、`iframe` と成果物同梱を不採用にした。
- preload、prefetch、preconnect、startup fetchを明示的に禁止した。
- カード側継続をUI契約、仕様、検証、リスクへ追加した。
- 2Dアクションのbuild identity照合を公開完了条件へ追加した。
- URL catalog等の将来抽象化は、複数ゲーム要件が出るまで追加しない方針にした。

再レビューの結果、ユーザー要件を満たすための未決のアーキテクチャ選択は残っていない。実装時に必要な外部判断は、公開操作そのものに対するユーザー承認だけである。
