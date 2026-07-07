# Codex への作業引き継ぎ指示文 (PR2 v2 の残り)

このドキュメントは **カードオセロ `othello_v2`** の UI 軽量化プロジェクト、PR2 v2 の **残り作業 (ステップ 4, 5)** を Codex (Codex CLI 等) にそのまま渡すための指示文です。

ステップ 1〜3 は既にコミット済みです。Codex はこのドキュメントを上から読み、不明点があれば着手前に人間 (= ユーザー) に質問してから動いてください。

---

## 1. 全体像 (背景)

- **プロジェクト**: カードオセロ `othello_v2` (リポジトリ直下、Windows 環境)
- **作業テーマ**: UI 表示速度の軽量化 (board rendering まわり)
- **段階**:
  - PR1 — perf marks のインストルメント追加
  - PR1.5 — `renderBoardDiff` 計測ゲーティング追加
  - PR2 — `syncBoardPixelSizing` dirty gate 追加
  - **PR2 v2 — `syncBoardPixelSizing` シグネチャ拡張 + page-state triggers 追加** ← 今ここ
- **2026-07-06 時点**: PR2 v2 のステップ 1〜3 完了・コミット済み
- **残り**: ステップ 4 (Playwright で計測) と ステップ 5 (最終レポート)

## 2. 直近のコミット履歴 (参考)

```
5b10c9338 build: refresh browser module registry after PR2 v2 signature expansion
76ba94feb feat(ui): expand syncBoardPixelSizing signature + add page-state triggers (PR2 v2)
b681bbfe6 build: refresh browser module registry after PR2 dirty gate
75ba6578c feat(ui): add syncBoardPixelSizing dirty gate (PR2: N3)
6fc3cc0b0 build: refresh browser module registry after PR1.5 instrumentation gating
9370d4bbf chore(ui): gate renderBoardDiff instrumentation behind isPerfBenchEnabled (PR1.5)
```

## 3. 人間 (= ユーザー) の作業スタイル — 必ず守る

1. **段取りを先に出す** — いきなり実装に着手せず、計測スクリプトの構成・実行方法・出力フォーマットを 1 段落で見せてから動く
2. **区切りごとに動作確認** — 計測スクリプトを書き終えたら実行し、結果を添えて次に進む
3. **大きな判断は AI だけで決めない** — 計測条件・レポート粒度・新規 npm script の追加で判断に迷ったら停止して人間に聞く
4. **エラーは隠さず報告** — 計測が想定通り出なかったら、ログ付きで報告する
5. **UI 動作を変えない** — 計測が目的なので「計測用の特別パス」を入れるなど通常プレイに影響する変更を入れない。`?debug=1` 系の裏口も計測専用に新規追加しない
6. **コミットは明示指示があるまでしない** — 計測スクリプトやレポートファイルが新規追加される場合、commit は人間に確認してから
7. **進捗は小分けに** — 1 コミットに複数機能を詰めない。dirty な状態を作らない

## 4. リポジトリ / 環境

- **パス**: `C:\Users\quarr\Desktop\othello_v2` (Windows)
- **シェル**: PowerShell
  - `&&` は使えない。`;` を使う
  - bash 由来コマンド (`ls -la`, `head`, `tail`, `grep`, `wc`) は使わない
  - bash で失敗したら `node` / `python` に切り替える (最大 2 回まで)
- **主要ディレクトリ**:
  - `ui/` — ブラウザ UI、board rendering 実装
  - `ui/perf-benchmarks/` — PR1 で追加された計測補助
  - `tests/` — visual regression / Playwright セットアップ
  - `scripts/` — ビルド補助スクリプト
  - `docs/perf/` — 既存の計測レポート置き場
- **Playwright は既に動く前提** (このリポジトリでは e2e で使われている)

## 5. 残タスク詳細

### ステップ 4 — Playwright で計測

**目的**: PR2 v2 の効果 (board rendering が軽くなったか) を数字で取る。

実装してほしい内容:

1. **計測スクリプトの設計** を先に 1 段落で見せる
   - 計測シナリオ (例: 通常対局 / カード使用 / 局面切替 / リサイズ)
   - 採用する指標 (PR1 で追加した perf marks の名前、Navigation Timing の各値、FID / LCP / CLS 等)
   - 試行回数と集計方法 (中央値・平均・p95 等)
   - 比較対象 (PR2 以前との差分を取るか、それとも PR2 v2 単独の絶対値のみか)
2. **スクリプトを書く**
   - 置き場: `tests/perf/` か `scripts/perf/` 配下、既存の命名規則に合わせる
   - 既存の perf benchmark 実装 (`ui/perf-benchmarks/`) があれば活用する
3. **実行する**
   - 既存 `npm run` スクリプトが使えるならそれを優先
   - 無ければ新規 npm script を追加 (これも人間に確認)
4. **結果 (数字) を `docs/perf/2026-07-06-pr2-v2.md` 等に保存**
   - 人間可読な Markdown + 機械可読な JSON の二段構えが望ましい

**やってはいけないこと**:
- 通常プレイに影響する変更を入れない
- 既存のテストを skip / disable にしない
- CI を完走させる必要はない (計測が目的なので)
- 計測のために `?debug=1` のフラグを増やす等、本番経路に裏口を追加しない

### ステップ 5 — 最終レポート

**目的**: 軽量化の効果と手動確認項目をまとめて人間に渡す。

書いてほしい内容 (`docs/perf/2026-07-06-pr2-v2-report.md` のような場所):

1. **何を変えたか** — PR2 v2 の差分要約 (PR2 からの追加点を中心に)
2. **計測結果** — ステップ 4 の数値を貼る。表 / グラフは無理に作らず Markdown 表で OK
3. **PR1 → PR1.5 → PR2 → PR2 v2 での推移** — 既存レポートがあれば引用、なければ「PR2 v2 単独」と注記
4. **手動確認項目** — 人間 (= ユーザー) がゲームを開いて確認するべき観点 5〜10 個
   - 例: 軽いケース (序盤の手番)、重いケース (終盤の密盤面)、カード使用時の演出 (フリップ音 / ハイライト)、ウィンドウリサイズ時の再レイアウト、タブ切り替え復帰時
5. **残課題 / 次の PR 候補** (任意)

## 6. 作業報告フォーマット

各ステップの最後に、Codex は以下の形式で人間に報告してください:

```
[ステップ N 完了]
- やったこと:
- 変更ファイル / 新規ファイル:
- 計測 / 確認結果:
- 次のステップに進んで OK か: [要確認 / OK]
- 残課題 / 懸念:
```

## 7. 緊急停止条件 (下記に該当したら即停止して人間に報告)

- 計測中に予期せぬ console error / network error が出た
- 既存の test が落ち始めた
- UI 動作に副作用が出始めた (フリップ音の遅延、ハイライト位置ズレ、ログのスキップ等)
- 計測値が PR2 以前より明確に悪化した

## 8. 不明点があれば

- 計測条件・レポート粒度・新規 npm script の追加などは、推測で進めず人間に直接聞く
- このドキュメントの不明点を Codex 側で列挙してから着手するのも OK