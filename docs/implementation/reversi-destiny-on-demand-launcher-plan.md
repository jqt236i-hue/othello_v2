# 2Dアクション オンデマンド起動導線 実装計画

## 1. 文書の役割

- 状態: 実装前・セルフレビュー済み
- 設計正本: [2Dアクション オンデマンド起動導線 設計書](reversi-destiny-on-demand-launcher-design.md)
- 対象リポジトリ:
  - `C:\Users\quarr\Desktop\othello_v2`
  - `C:\Users\quarr\Documents\2Dアクション`
- 目的: 会話履歴がなくても、設計正本どおりに公開、UI追加、生成、検証、引き渡しを完了できる実行手順を定める

設計書と本計画が食い違う場合は設計書を優先し、客観的なソース根拠で設計誤りが判明した場合は、先に設計書を修正・再レビューしてから本計画を同期する。

## 2. 実装上の不変条件

1. 2Dアクションのコードや成果物をカードリバーシのbrowser module graphへimportしない。
2. 2Dアクションの `dist/` をカードリバーシのroot、`vite-dist/`、`worker-public/` へコピーしない。
3. カードリバーシ起動時に2Dアクション公開originへ通信しない。
4. 導線はnative `<a>` とし、非同期 `window.open`、`iframe`、startup `fetch` を使わない。
5. `game/`、`shared/`、CPU、カードlogic、network authorityを変更しない。
6. `index.classic.html` を先に変更し、生成HTMLやWorker mirrorをsource-editしない。
7. 2Dアクションの `dist/` をsource-editしない。
8. 外部公開、commit、pushは各リポジトリのAGENTSと権限規則に従う。特に2Dアクションの公開とcommitはユーザーの明示承認なしに実行しない。

## 3. 実施順序

## Step 1: 両リポジトリの作業状態と正本を再確認する

### 成果

実装対象と既存変更を分類し、他作業を巻き込まずに作業できる状態を確定する。

### 対象

- `C:\Users\quarr\Desktop\othello_v2\AGENTS.md`
- `C:\Users\quarr\Desktop\othello_v2\docs\AGENTS.md`
- `C:\Users\quarr\Desktop\othello_v2\ui\AGENTS.md`
- `C:\Users\quarr\Desktop\othello_v2\scripts\AGENTS.md`
- `C:\Users\quarr\Documents\2Dアクション\AGENTS.md`
- 本設計書・本計画書

### 実行

1. 両リポジトリで `git status --short` を実行する。
2. カードリバーシに残っている既存の広範な変更を本タスク外として分類し、対象ファイルと重なる場合はそのdiffを先に確認する。
3. 2Dアクションは現在HEADがなく全sourceが未追跡であるため、削除・初期化・一括stageを行わない。
4. `index.classic.html`、`styles-layout-controls.css`、`scripts/build-vite-entry.ts`、関連testの現状を読む。
5. 2D側の `package.json`、`vite.config.ts`、`README.md`、`dist/build-identity.json` の現状を読む。

### 完了条件

- task-owned fileと既存変更の境界が明文化できる。
- 既存変更を上書きせずに進められる。
- 設計書の現状根拠が実ソースと一致している。

## Step 2: 2Dアクションの公開候補buildを検証する

### 成果

カードリバーシから参照する前に、2Dアクション単体の公開可能な静的成果物を確定する。

### 対象

- `C:\Users\quarr\Documents\2Dアクション\src\`
- `C:\Users\quarr\Documents\2Dアクション\public\`
- `C:\Users\quarr\Documents\2Dアクション\vite.config.ts`
- `C:\Users\quarr\Documents\2Dアクション\dist\`（生成物）

### 実行

1. 5173/5174のlisten processを2DリポジトリのAGENTSどおりに確認する。
2. 2Dリポジトリで次を実行する。
   - `npm test`
   - `npm run typecheck`
3. dev/preview processが残っていないことを確認してから `npm run build` を実行する。
4. `dist/index.html`、hash付きJS/CSS、代表画像、代表音声、`dist/build-identity.json` の存在を確認する。
5. build identityのalgorithm、oracle fingerprint、product fingerprint、file countを記録する。
6. production previewを5173で一つだけ起動し、次を確認する。
   - `/` が200
   - HTML参照JS/CSSが200
   - 代表画像・音声が200
   - Phaser canvasが存在し0でないサイズ
   - タイトル画面と21ステージ導線
   - console warning/errorが0
7. 確認後、実装者が起動したpreviewを停止する。

### ordering

このStepが成功する前に公開やカード側URL固定へ進まない。

### 完了条件

- `dist/` が単独の静的サイトとして動く。
- sourceとbuild identityの対応が記録される。
- 失敗したtestやasset 404が残っていない。
- 5173/5174に重複serverが残っていない。

## Step 3: 2Dアクションを独立HTTPS URLへ公開する

### 成果

カードリバーシから参照できる安定した2Dアクション公開URLを取得する。

### 実行

1. 公開直前に、外部サービスへの書き込みであること、公開対象がStep 2の `dist/` であること、想定公開先が独立Cloudflare Pagesプロジェクトであることをユーザーへ示して明示承認を得る。
2. 承認後、既存アカウントの安全な公開手順で `dist/` を独立Pages projectへdeployする。
3. 返されたHTTPS production URLを記録する。preview固有URLではなく、安定production URLを採用する。
4. 公開URLでStep 2と同じHTML、JS/CSS、代表asset、canvas、タイトル、console確認を行う。
5. 公開HTMLに埋め込まれたbuild identityと、Step 2で記録したidentityが一致することを確認する。
6. 認証tokenやaccount情報をlog、文書、commitへ残さない。

### エラー時

- 公開に失敗した場合、カード側へ仮URLやpreview URLを埋め込まない。
- 権限不足の場合は、必要なユーザー操作だけを説明して停止する。
- source/build identityが一致しない場合は再buildからやり直す。

### 完了条件

- 安定HTTPS production URLが得られる。
- URLで2Dアクションが実動作する。
- 公開物のbuild identityが検証済み候補と一致する。

## Step 4: 2Dアクションの運用文書を更新する

### 成果

公開URLと再公開手順が2Dアクション側の運用正本から確認できる。

### 対象

- `C:\Users\quarr\Documents\2Dアクション\README.md`

### 実行

1. production URLを記載する。
2. `npm test` → `npm run typecheck` → server停止 → `npm run build` → 公開 → real URL smokeの順序を記載する。
3. `dist/` が生成物であり直接編集しないことを維持する。
4. カードリバーシから別タブで起動されること、カード側とのstate/API連携がないことを記載する。
5. build identityの照合位置と確認項目を記載する。

### 検証

- `git diff --check -- README.md`
- README内のコマンド、ファイル、URLをsourceと照合する。
- Markdown表示を確認する。

### 完了条件

- 別の実装者がREADMEだけでbuildと公開確認を再現できる。
- ゲーム内容の仕様変更を含まない。

## Step 5: カードリバーシのプレイヤー向け仕様と内部境界を更新する

### 成果

UIを実装する前に、表示と責務の正本を確定する。

### 対象

- `C:\Users\quarr\Desktop\othello_v2\01-rulebook.md`
- `C:\Users\quarr\Desktop\othello_v2\docs\architecture-contracts.md`

### 実行

1. `01-rulebook.md` のUI導線節へ次を追加する。
   - 左メニューの表示名は `2Dアクション`
   - 別タブで開く
   - カードリバーシは元タブで継続する
   - 2Dアクションはリンクを押すまでロードしない
2. `docs/architecture-contracts.md` §5.1.1付近へ次の安定境界を追加する。
   - companion gameは独立公開アプリ
   - Card browser module graph、Worker mirror、canonical stateへ入れない
   - native top-level navigationだけを境界とする
   - preload/prefetch/preconnect/startup fetchを行わない
3. カード、ターン、盤面、演出、音声挙動は変わらないため `正本/*.md` は変更しない。

### 検証

- `git diff --check -- 01-rulebook.md docs/architecture-contracts.md`
- 参照節、表示名、設計書との一致を確認する。

### 完了条件

- プレイヤー向け挙動と内部境界が実装前に正本化される。
- 2Dアクションが対局モードではないことが明確である。

## Step 6: 左メニューへnative linkを追加する

### 成果

カードリバーシのゲームlogicへ接続せず、公開2Dアクションを実クリック時だけ開く導線を実装する。

### 対象

- `C:\Users\quarr\Desktop\othello_v2\index.classic.html`
- `C:\Users\quarr\Desktop\othello_v2\styles-layout-controls.css`

### HTML契約

`#leftActionButtons` のレート戦導線の後、ランキング等の補助導線の前に一つだけlinkを追加する。

- id: `reversiDestinyOpenLink`
- class: 既存の `btn-small left-action-btn` と専用class
- label: `2Dアクション`
- href: Step 3で検証したproduction HTTPS URL
- `target="_blank"`
- `rel="noopener noreferrer external"`
- `referrerpolicy="no-referrer"`
- `aria-label="2Dアクションを別タブで開く"`
- titleまたは視覚補助で `別タブで開く・カードリバーシは継続` を明示

`aria-expanded`、mode state、lazy-load state、network stateを付けない。click handler、`window.open`、`fetch` を追加しない。

### CSS契約

1. `<a>` が既存buttonと同じ寸法、grid、文字色、focus-visible、hoverを持つよう、text-decoration等をrailスコープで整える。
2. 2Dアクション専用icon maskとtoneを追加する。
3. 既存buttonのselector列に必要な範囲だけ専用idを加える。
4. rail全体の高さが狭いviewportを超える場合だけ、rail内のgap/min-height/scaleまたは既存responsive ruleを調整する。
5. 盤面、手札、quick controls、board writer、game座標は変更しない。

### 禁止

- `ui/bootstrap.ts`、`ui/bootstrap/init-*`、`entry-browser.js` へのlistener追加
- optional registryやVite lazy groupへの登録
- 2Dアクションoriginへのpreconnect/prefetch
- query、player ID、room ID、tokenのhref付加

### 完了条件

- JavaScriptなしでリンクが機能する。
- Card起動処理のimportやruntime stateが増えていない。
- desktop/mobileでリンクとrail toggleを操作できる。

## Step 7: 契約testとbrowser smokeを追加・更新する

### 成果

「初期ロードなし」「別タブ起動」「Card無変更」を退行検出できる。

### 対象候補

- `test/scripts.vite-entry.test.ts`
- 新規 `test/ui.companion-game-link.test.ts`
- 新規または既存script配下のbrowser smoke

### focused test

1. 正本HTMLを読むtestで次を検証する。
   - `#reversiDestinyOpenLink` が一つ
   - production HTTPS `href`
   - `target="_blank"`
   - `rel` に `noopener`、`noreferrer`、`external`
   - `referrerpolicy="no-referrer"`
   - accessible name
   - `iframe`、preload/prefetch/preconnect、2D script/style参照がない
2. Vite entry生成testで、native linkと属性が生成documentへ保持されることを検証する。
3. source boundary testまたはfocused searchで、公開URLやlink idが `game/`、`shared/`、CPU、workersに現れないことを検証する。

### browser smoke

1. Cardのdefault Vite pageを開き、readyまで全request URLを記録する。
2. 2Dアクションoriginへのrequestが0であることをassertする。
3. linkが表示・有効・focus可能であることを確認する。
4. Playwrightのnew Page待受と実clickを同じ同期区間で行い、新しいPageが一つ開くことを確認する。
5. 新Pageのproduction URL、タイトル、canvas、代表asset、console errorを確認する。
6. 元PageのURL、runtime ready、選択modeが変わっていないことを確認する。
7. viewportを少なくともdesktop、狭い横画面、mobile相当で確認する。

外部URLを使うreal-operation smokeは公開後に行う。CIで外部可用性を常時必須にせず、HTML/source契約testとlocal UI layout testを安定gateにする。

### 完了条件

- startup external request 0が自動または記録可能なbrowser testで確認できる。
- click後だけnew Pageが開く。
- Card runtimeの退行がない。

## Step 8: カードリバーシの生成と検証を行う

### 成果

classic、Vite、Worker公開mirrorを正規手順で同期し、UI変更を公開可能にする。

### 実行順

1. Step 7のfocused Jestを実行する。
2. `npm run build:browser`
3. `npm run build:vite`
4. 最小のUI/browser smoke
5. `npm run worker:prepare`
6. `npm run check:worker-mirror`
7. `npm run match:production-delivery-smoke:vite`
8. `git diff --check`

### 確認

- `index.vite.html` と `index.html` にlinkが生成される。
- `worker-public/index.html` と `worker-public/index.classic.html` にlinkがmirrorされる。
- `worker-public/` に2DアクションのJS/CSS/assetsが追加されていない。
- Card ready時の2D origin requestが0。
- console/page/resource errorが0。
- 既存Cardのboot、盤面、左rail collapse、CPU/ネット対戦導線が動く。

### 完了条件

- 全コマンドが成功する。
- 生成差分がsource変更から説明できる。
- 2D配信物の複製がない。

## Step 9: 両公開URLで最終結合確認する

### 成果

ローカルだけでなく、ユーザーが使う公開URLで要件を確認する。

### 実行

1. カードリバーシの公開は外部状態変更なので、実行直前にユーザー承認を得る。
2. 既存の `worker:deploy` 手順でCardを公開する。
3. 新しいbrowser contextでCard production URLを開く。
4. Card readyまで2D production originへのrequestが0であることを記録する。
5. `2Dアクション` linkを実クリックする。
6. new PageのURL、title、Phaser canvas、代表asset、console warning/errorを確認する。
7. 元のCard tabへ戻り、URL、盤面、入力、CPU/ネットUIが壊れていないことを確認する。
8. AUTOまたはネット対戦が元タブで継続し得るという仕様表示が実装と一致することを確認する。

### 完了条件

- 公開Cardから公開2Dアクションをクリック時だけ開ける。
- Card startup request 0とnew tab navigationの証拠がある。
- 2D canvasの実描画を確認できる。
- 両Pageで未説明のconsole/page/resource errorがない。

## Step 10: 最終diff、文書、deliveryを整理する

### 成果

task-owned変更だけを引き渡し、既存作業を混ぜない。

### 実行

1. 両リポジトリで `git status --short` を実行する。
2. task-owned diffをファイル単位で確認する。
3. Card側は既存の無関係なdirty filesをstageしない。
4. Card側はAGENTSのcommit policyに従い、task-ownedで検証済みの差分を分離できる場合だけ自動commitする。
5. 2D側のcommitはAGENTSが明示承認を要求するため、ユーザー承認がない限りstage/commitしない。
6. 実行したtest、build、browser URL、server mode、公開URL、build identity、未実行項目を最終報告へ記載する。
7. 2D側が現在HEADなし・全未追跡であることを、公開物identityと別に明確に報告する。

### 完了条件

- task外diffがcommitや報告へ混ざっていない。
- 正本、実装、test、生成物、公開URLが一致する。
- 公開操作、commit、未追跡sourceの扱いが権限規則どおりである。

## 4. 要件と工程の対応

| ユーザー要件 / 設計完了条件 | 対応Step |
| --- | --- |
| カードリバーシから開ける | 3, 6, 9 |
| 公開URLで動く | 2, 3, 9 |
| Card起動時にロードしない | 6, 7, 8, 9 |
| `2Dアクション` 押下時だけロード | 6, 7, 9 |
| 既存ゲームlogicを汚さない | 5, 6, 7, 8 |
| 2D成果物をCard Workerへ複製しない | 6, 8 |
| 新しいタブで開く | 6, 7, 9 |
| Cardは元タブで継続 | 5, 6, 7, 9 |
| mobile/desktopで操作可能 | 6, 7 |
| 2D Phaser canvasが実動作 | 2, 3, 9 |
| source/build identityを取り違えない | 2, 3, 4, 10 |
| 正本・生成・mirror同期 | 5, 8, 10 |

## 5. 最終チェックリスト

- [ ] 両リポジトリの既存変更を分類した
- [ ] 2Dのtest/typecheck/build/preview smokeが成功した
- [ ] 2D build identityを記録した
- [ ] ユーザー承認後に2Dを独立HTTPS公開した
- [ ] 公開2Dのidentityとcanvasを確認した
- [ ] 2D READMEを更新した
- [ ] Card `01-rulebook.md` と `docs/architecture-contracts.md` を更新した
- [ ] `index.classic.html` にnative external linkを一つ追加した
- [ ] 2D URLをscript/style/preload/prefetch/preconnectへ使っていない
- [ ] Card core/CPU/network/Worker authorityを変更していない
- [ ] focused testでHTML属性とVite生成保持を確認した
- [ ] browserでCard startupから2D originへのrequest 0を確認した
- [ ] clickでnew Pageが一つ開くことを確認した
- [ ] desktop/狭い横画面/mobileでrailを確認した
- [ ] `npm run build:browser` が成功した
- [ ] `npm run build:vite` が成功した
- [ ] `npm run worker:prepare` とmirror checkが成功した
- [ ] 2D配信物がCard `worker-public/` に複製されていない
- [ ] ユーザー承認後にCardを公開した
- [ ] 両production URLのreal-operation smokeが成功した
- [ ] 最終status/diffでtask外変更を混ぜていない
- [ ] 権限規則に従ってcommitまたは未commit理由を報告した

## 6. Self-review

### 確認した問題

1. 最初の工程案では、Card実装後に2D公開URLを決める順序になり、仮URLが残り得た。
2. 単体UI testだけでは「起動時に外部通信がない」を証明できない。
3. link追加で既存railの高さが変わるため、desktop一種類の確認では不十分だった。
4. 2Dリポジトリのcommit policyと、現在HEADがない状態を通常のCard commit手順へ混ぜる危険があった。
5. 公開後のbuild identity照合がなければ、検証した `dist/` と公開物が同一とは限らなかった。
6. CardのWorker mirrorへ2D成果物を誤って含めない確認が、初案では完了条件に弱かった。

### 修正

- 2D単体検証・公開・安定URL確定をCard UI実装より先へ移した。
- request記録を使うbrowser smokeを明示し、startup 0件とclick後navigationを分けて検証する。
- desktop、狭い横画面、mobile相当のrail確認を追加した。
- 両リポジトリのcommit/公開権限と未追跡sourceの扱いをStep 1、3、10へ固定した。
- build identityを単体build、公開、最終報告で照合する工程を追加した。
- `worker-public/` に2D配信物がないことをStep 8と最終チェックリストへ追加した。

再レビューの結果、本計画は設計書を実装する順序、正本、canonical source、生成物、公開、検証、権限、完了条件を一貫して扱っている。外部公開に対するユーザー承認以外に、実装担当が新たに選ぶべきアーキテクチャ判断は残っていない。
