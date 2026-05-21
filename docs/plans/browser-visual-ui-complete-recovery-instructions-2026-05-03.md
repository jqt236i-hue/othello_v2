# ブラウザ表示・操作UI 完全復旧指示書

**作成日**: 2026-05-03  
**対象**: `index.html`, `styles-*.css`, `entry-browser.js`, `ui/`, `scripts/`, `worker-public/`  
**状態**: 実行指示  
**起票理由**: ブラウザ起動不能の復旧後も、文字化け、右下操作UI欠落、主要UI崩れが残り、正常起動とは言えないため

---

## 0. この文書の位置づけ

- この文書は、`docs/plans/browser-boot-recovery-master-plan-2026-05-02.md` の完了報告後に残った表示品質不具合を、完全に復旧するための実行指示書である。
- 一次仕様は `01-rulebook.md`、内部契約は `docs/architecture-contracts.md`、進め方は `AGENTS.md` に従う。
- 今回の主眼は仕様変更ではなく、ブラウザで実際に見える UI と日本語表示を、仕様どおりに戻すことである。
- `worker-public/` は mirror であり、直接修正で完了扱いにしない。必ず root 正本を直してから `npm run worker:prepare` で同期する。

## 1. 現在の未復旧症状

ユーザー確認のスクリーンショットでは、少なくとも次が未復旧である。

- 画面左上、カード名、操作説明、右下操作UIなどで日本語が文字化けしている
- 右下操作UIの一部が消えている、または本来の表示名ではない壊れた文字列になっている
- `</button>` などの HTML 断片が画面上に露出しており、HTML 構造破損が残っている
- 盤面は表示されているが、これだけでは「正常起動」と判定できない
- 右下の操作パネル、モード表示、パス/リセット/ネット対戦/自動操作系の視覚状態が完了条件から漏れていた

## 2. 根本原因の仮説

今回の不具合は、単一のブートエラーではなく、次の複合問題として扱う。

- `index.html` または関連 HTML 断片が mojibake 状態で保存されている
- HTML タグの閉じ忘れ、属性途中切れ、壊れたテキスト混入により DOM 構造が変形している
- 前回復旧で「起動」「盤面表示」だけを合格条件にしたため、右下操作UIと日本語表示の検証が不足した
- `worker-public/` へ壊れた root 表示資産が同期され、実ブラウザ確認でも破損が再現している

この仮説は実装前に検証し、外れていた場合は本書の Phase 0 に原因を追記してから進める。

## 3. 完全復旧の定義

この作業では、次をすべて満たすまで復旧完了としない。

1. ブラウザでゲームが起動し、盤面が 64 マス表示される
2. 初期配置、手札、ターン開始が成立する
3. 画面上に mojibake が残らない
4. `</button>`, `</div>`, `alt=`, 壊れた属性断片などの HTML 断片が表示されない
5. 左下固定ボタン群が `ガチャ`, `ランキング`, `デッキ`, `STORY`, `help`, `SKIN` として表示される
6. 勇者名が `リバーシの勇者` として表示される
7. 敵名が `盤喰いの小鬼` として表示される
8. 右下操作UIに、仕様上必要な操作ボタンと状態表示が欠落なく表示される
9. `AUTO: OFF` が表示され、自動操作の切替ボタンとして機能する
10. `worker-public/` で同じ確認が通る
11. `npm run test:browser:smoke` が、視覚崩れ検出を含めて green になる

## 4. 非目標

- ゲームルール変更
- 右下操作UIの新デザイン化
- レイアウト方針の刷新
- カード効果や CPU 思考の変更
- 仕様にない新規 UI の追加

## 5. 作業原則

- `01-rulebook.md` の表示名と UI 仕様を正とする。
- root の `index.html`, `styles-*.css`, `ui/` を正本として修正する。
- `worker-public/` は最後に同期するだけにする。
- 文字化けを「目視でなんとなく直す」のではなく、検出対象文字列と Playwright 検証を追加して再発を防ぐ。
- 既存の正常な日本語文言は `git` 履歴、`01-rulebook.md`、画面仕様、catalog の表示名から復元する。
- HTML 構造破損は局所的な文字列置換で済ませず、DOM ツリーとして正しい構造に戻す。

## 6. Phase 0: 現状証拠の固定

**目的**: 修正前の壊れ方を保存し、同条件で復旧確認できるようにする。

**タスク**:

1. `npm run worker:prepare` を実行せず、まず現状の root と `worker-public/` の差分を確認する
2. `git status --short` で未コミット変更を記録する
3. Playwright で `worker-public/index.html?debug=1` または smoke と同じ URL を開く
4. スクリーンショットを `tmp/browser-visual-before-2026-05-03.png` に保存する
5. DOM の主要テキストを取得し、mojibake と HTML 断片をログ化する

**最低取得項目**:

- `document.body.innerText`
- `#side-panel` の `innerText`
- `#game-container` の親要素
- `#board` の `children.length` と `getBoundingClientRect()`
- 左下固定ボタン群の `innerText`
- `console.error` / `pageerror` / 404 response 一覧

**完了条件**:

- 修正前スクリーンショットが保存されている
- 文字化けしている DOM 範囲が特定されている
- 右下操作UIの欠落が DOM 欠落なのか、CSS 非表示なのか、文字列破損なのか分類されている

## 7. Phase 1: 文字化けの発生源特定

**目的**: mojibake の混入元を root 正本単位で特定する。

**タスク**:

1. `index.html`, `styles-*.css`, `ui/`, `cards/`, `game/`, `public/module-registry.js`, `entry-browser.js` から典型的な mojibake 文字列を検索する
2. `縺`, `繧`, `螟`, `蜍`, `謇`, `闔`, `髫`, `譁`, `莨`, `繝`, `�` を検出対象にする
3. 検出結果を root 正本、生成物、mirror に分類する
4. root 正本にある mojibake は修正対象にする
5. `dist/`, `public/module-registry.js`, `worker-public/` の mojibake は root 修正後に再生成で消す対象にする

**参考コマンド**:

```powershell
rg -n "縺|繧|螟|蜍|謇|闔|髫|譁|莨|繝|�" index.html styles-*.css ui game cards entry-browser.js
rg -n "</button>|</div>|alt=|button>" index.html ui
```

**完了条件**:

- root 正本に残る mojibake 箇所が一覧化されている
- 生成物だけの mojibake と root 由来の mojibake が分離されている
- 修正対象ファイルが確定している

## 8. Phase 2: HTML 構造の復旧

**目的**: 画面上に HTML 断片が露出しない DOM 構造へ戻す。

**優先対象**:

1. `index.html`
2. `ui/` 配下のテンプレート生成箇所
3. `entry-browser.js` 内で DOM を直接生成している箇所

**タスク**:

1. `index.html` を HTML パーサで検査し、壊れた開始タグ、閉じタグ、属性を特定する
2. `#game-container`, `#side-panel`, `#right-action-panel`, `#networkPanel`, `#autoToggleBtn`, `#sidePanelToggleBtn` 周辺の親子関係を確認する
3. 右下操作UIが hidden section や別 overlay に飲み込まれていないことを確認する
4. 仕様に沿う表示名へ戻す
5. 画面上にタグ断片が表示される原因を除去する

**復旧時の禁止事項**:

- `worker-public/index.html` だけを直接直して完了扱いにする
- 壊れた HTML 断片を CSS で隠す
- mojibake 文字列をそのまま別要素へ移す
- 右下操作UIを一時的に削除して smoke を通す

**完了条件**:

- `document.querySelector('#side-panel')` が存在する
- `#side-panel` が表示領域内にある
- `#side-panel` 内に壊れた HTML 断片がない
- `document.body.innerText` に `</button>` や `</div>` が含まれない

## 9. Phase 3: UI 表示名と日本語文言の復旧

**目的**: 起動時に見える主要 UI の日本語表示を仕様どおりに戻す。

**必須復旧対象**:

| UI | 期待表示 |
| --- | --- |
| ガチャボタン | `ガチャ` |
| ランキングボタン | `ランキング` |
| デッキボタン | `デッキ` |
| STORY ボタン | `STORY` |
| help ボタン | `help` |
| SKIN ボタン | `SKIN` |
| 勇者名 | `リバーシの勇者` |
| 敵名 | `盤喰いの小鬼` |
| AUTO ボタン | `AUTO: OFF` |
| スキン関連 | `手`, `背景`, `見た目設定` |
| ガチャ関連 | `観測ガチャ`, `観測石`, `1回ガチャ`, `10連ガチャ` |

**タスク**:

1. `01-rulebook.md` の UI 表示名と照合する
2. catalog 由来のカード名や敵名は正本データから取得する
3. ハードコード文言は UTF-8 の正しい日本語へ戻す
4. 画像パスに日本語ファイル名がある場合は、実ファイル存在と URL エンコード後の 404 有無を確認する
5. `assets/images/hand-skin/勇者の手.png` などの日本語パスは、実ブラウザで 200 を確認する

**完了条件**:

- 起動直後の `document.body.innerText` に mojibake 検出パターンがない
- 主要 UI の期待表示がすべて DOM に存在する
- 日本語ファイル名資産に 404 がない

## 10. Phase 4: 右下操作UIの復旧

**目的**: 右下操作UIを「存在する」だけでなく、操作可能な状態へ戻す。

**確認対象**:

- `#side-panel`
- `#sidePanelToggleBtn`
- `#autoToggleBtn`
- パス操作ボタン
- リセット操作
- ネット対戦設定またはモード表示
- 現在手番と状態表示
- インジケーター表示切替

**タスク**:

1. `01-rulebook.md` の右下操作UI関連記述を読む
2. `index.html` の要素 ID と `ui/` のイベントバインド先が一致しているか確認する
3. CSS による `display:none`, `visibility:hidden`, `opacity:0`, `transform` 退避、z-index 埋没を確認する
4. 折りたたみボタンを押して、非表示と再表示が切り替わることを Playwright で確認する
5. `AUTO: OFF` を押して表示が切り替わることを確認する
6. 右下操作UIが画面下端から欠けないことを 1920x919 と 1366x768 で確認する

**完了条件**:

- 右下操作UIの主要ボタンが表示される
- 右下操作UIがクリック可能である
- 折りたたみ/再展開が動作する
- `AUTO: OFF` が初期表示される
- 低めの横画面でも下端に欠けない

## 11. Phase 5: 検証スクリプトの強化

**目的**: 「盤面が出たが UI は壊れている」を smoke で検出できるようにする。

**対象候補**:

- `scripts/browser-boot-smoke.js`
- 必要なら `tests/` または `test/` 配下の browser smoke

**追加すべき検査**:

1. `#board` が 64 マスで表示サイズを持つ
2. `#side-panel` が存在し、表示サイズを持つ
3. `#autoToggleBtn` の text が `AUTO: OFF` または許容される状態表示である
4. `document.body.innerText` に mojibake パターンがない
5. `document.body.innerText` に HTML 断片がない
6. 左下固定ボタン群の期待文言が存在する
7. 勇者名と敵名が期待表示で存在する
8. 404 response がない
9. `console.error` と `pageerror` に未許容エラーがない

**mojibake 検出パターン**:

```js
const MOJIBAKE_PATTERN = /縺|繧|螟|蜍|謇|闔|髫|譁|莨|繝|�/;
const HTML_FRAGMENT_PATTERN = /<\/(?:button|div|span)>|(?:^|\s)(?:alt|class|id)=["']?/;
```

**完了条件**:

- 壊れたスクリーンショット相当の状態で smoke が fail する
- 復旧後の状態で smoke が green になる
- smoke の合格条件が本書の完全復旧定義を最低限カバーする

## 12. Phase 6: 生成と同期

**目的**: root 正本の復旧を派生物へ正規反映する。

**実行順**:

1. `npx tsc --noEmit`
2. `npm run build:ts`
3. `node dist/scripts/build-module-registry.js`
4. `npm run worker:prepare`

**確認**:

- `worker-public/index.html` に root の修正が反映されている
- `worker-public/entry-browser.js` が存在する
- `public/module-registry.js` が現行 `dist/` から再生成されている
- `worker-public/` 側に root 由来でない直接修正が残っていない

## 13. Phase 7: 最終ブラウザ検証

**目的**: 実ユーザーが見る画面として正常であることを確認する。

**必須検証**:

1. `npm run test:browser:smoke`
2. Playwright で `?debug=1` 起動
3. 1920x919 でスクリーンショット保存
4. 1366x768 でスクリーンショット保存
5. `#sidePanelToggleBtn` のクリック前後スクリーンショット保存
6. `#autoToggleBtn` のクリック前後の text 取得
7. 404 response がないこと
8. mojibake 検出パターンがないこと

**保存先**:

- `tmp/browser-visual-after-1920x919-2026-05-03.png`
- `tmp/browser-visual-after-1366x768-2026-05-03.png`
- `tmp/browser-side-panel-toggle-2026-05-03.png`

**完了条件**:

- スクリーンショット上で文字化けがない
- 右下操作UIが表示されている
- 操作UIが画面外に欠けていない
- 盤面、勇者、敵、左下ボタン群、右下操作UIが同時に成立している

## 14. 実行時の停止条件

次の場合は、独断で進めず原因と選択肢を報告する。

- `01-rulebook.md` と現行 UI のどちらが正しいか判断できない
- 右下操作UIの仕様が現行実装と矛盾している
- root 正本が複数あり、どれを採用すべきか決められない
- 未コミット変更が同じ HTML / CSS / UI ファイルにあり、上書きリスクが高い
- 文字化け復旧に大規模な文言再作成が必要になる

## 15. 完了報告で必ず書くこと

- 何を root 正本として修正したか
- 文字化けの混入元はどこだったか
- 右下操作UI欠落の原因は DOM 破損、CSS、イベントバインド、同期漏れのどれだったか
- `worker-public/` をどのコマンドで同期したか
- 実行した検証コマンドと結果
- 保存したスクリーンショットのパス
- `01-rulebook.md` を更新したかどうかと理由
- 残した警告がある場合、それが起動・表示・操作に影響しない根拠

## 16. 合格判定チェックリスト

最終的に、担当者は以下をすべて満たした場合だけ「完全復旧」と報告できる。

- [ ] `npx tsc --noEmit` が成功
- [ ] `npm run build:ts` が成功
- [ ] `node dist/scripts/build-module-registry.js` が成功
- [ ] `npm run worker:prepare` が成功
- [ ] `npm run test:browser:smoke` が成功
- [ ] `#board` が 64 マスで表示される
- [ ] `#side-panel` が表示される
- [ ] `#autoToggleBtn` が表示される
- [ ] 左下固定ボタン群が期待文言で表示される
- [ ] 勇者名と敵名が期待文言で表示される
- [ ] `document.body.innerText` に mojibake がない
- [ ] `document.body.innerText` に HTML 断片がない
- [ ] 404 response がない
- [ ] 1920x919 と 1366x768 のスクリーンショットで UI 欠けがない
- [ ] `worker-public/` でも同じ状態が再現する
- [ ] `01-rulebook.md` 更新要否を報告している

