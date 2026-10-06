# PROJECT KNOWLEDGE BASE

カードリバーシは、ブラウザ UI・headless game logic・network Worker・selfplay/CPU training を同じ repo で扱う JavaScript/TypeScript 中心のゲームです。

このファイルは repo 全体に適用する制約と参照先を定めます。対象パスに `AGENTS.md` / `AGENTS.override.md` があればそちらも適用されます。仕様・内部契約は変更に関係する箇所だけ参照し、索引を読み込み一覧や実行順序として扱わないでください。

## USER PROFILE

- ユーザーはプレイヤー兼プロダクトオーナーであり、Git を操作しない。コミット・プッシュ・巻き戻し・履歴の閲覧を一切しない。
- 報告は日本語で、画面や仕様書の日本語表示名を優先する。Git 用語や内部構造の説明は必要最小限にし、ユーザーに Git 操作や技術的な判断を求めない。
- 判断を仰ぐのは、資料と実装から決められない製品仕様の選択と、大きな範囲拡張だけ。
- Git の状態を伝える必要がある時は、先頭に「対応不要」か「あなたの判断が必要」を置き、選択肢は Git の操作名ではなく「ゲームや作業がどうなるか」で示し、推奨を 1 つ添える。未コミットや巻き戻しの話題でユーザーを不安にさせない。

## STANDARD FLOW

すべての実装依頼はこの順で進める。各段の詳細は後続の節にある。

1. 開始: `git status --short` で既存の未コミット変更を把握し、触らない対象を決める。ゲーム変更なら 8000 のサーバー状態も確認する。
2. 実装: 依頼された挙動を root source で実装し、影響する生成物を既存スクリプトで更新する。
3. 検証: 変更の対象に応じた検証を選び、今回の変更に起因する不具合は直す。
4. 反映: プレイ可能なゲームを変更したら `npm run build:vite` で通常配信へ反映し、8000 で HTTP 200 を確認する。
5. コミットと反映: 今回分をすべてコミットし、作業ツリーに残さない。続けて GIT HYGIENE の「反映」に従い、本体の `main` と GitHub へ反映する。
6. 報告: 変更内容、検証結果、未検証・未完了、GitHub への反映結果、別作業の未コミット件数を簡潔に示す。

調査・説明・レビューだけの依頼は 1 と結果の提示で完了。製品変更・ビルド・コミット・デプロイは含めない。

## WORKING PRINCIPLES

- 依頼の範囲内の調査・編集・ローカル検証・修正後の再検証は、その都度の承認を求めず進める。確認待ちの間も独立して進められる作業は続ける。
- 実装依頼は、要求された挙動の実装、影響に応じた検証、今回の変更に起因する不具合の修正、通常配信への反映、コミットまでを完了に含む。
- 調査方法や編集順序は任せる。計画書は、大きな変更や引き継ぎで判断・進捗を残す必要がある場合に [docs/AGENTS.md](docs/AGENTS.md) に沿って作る。
- 長時間の selfplay・訓練、本番デプロイ（`worker:deploy`）、課金を伴う操作はユーザーの依頼に含まれる場合に行う。秘密情報は出力・文書・コミットに含めない。

## SOURCE OF TRUTH

| 情報 | 参照先 |
| --- | --- |
| ゲーム仕様、カード効果、UI 表示・タイミング | [01-rulebook.md](01-rulebook.md) |
| カード・ターン・演出・音の詳細 | [正本/AGENTS.md](正本/AGENTS.md) から該当資料へ |
| 内部構造、authority、runtime 境界 | [docs/architecture-contracts.md](docs/architecture-contracts.md) |
| カード・通信の調査先と検証の候補 | [docs/game-maintenance-reference.md](docs/game-maintenance-reference.md) |
| 文書の置き場所と書き方 | [docs/AGENTS.md](docs/AGENTS.md) |
| 人間向けの運用判断材料 | [docs/HUMAN-DEV-GUIDE.md](docs/HUMAN-DEV-GUIDE.md)（エージェントは編集しない） |

資料と実装が食い違う場合は、関連仕様と変更履歴から意図を判断する。仕様変更は一次情報と該当する詳細仕様に反映し、明確な仕様違反は実装を直す。内部変更だけならカード仕様や演出資料の更新は不要。

## WHERE TO LOOK

| 対象 | 主な入口 |
| --- | --- |
| Browser boot | `entry-browser.js`, `browser-vite/main.ts`, `browser-vite/pixi-runtime-loader.ts`, `ui/bootstrap.ts`。配信入口 `index.html` は生成物。HTML 生成は `scripts/build-vite-entry.ts` |
| カード・ターン・描画・通信・関連テスト | [保守参照](docs/game-maintenance-reference.md) の該当項目 |
| CPU / training | `game/ai/`, `training/`, `src/engine/`。`cpu/` は compatibility/read-only、root `scripts/run-selfplay-*.js` は CLI entry |
| 共有処理 | `shared/`, `constants/`, `utils/` |
| Build / mirror | `package.json`, `scripts/prepare-worker-assets.ts`, `scripts/build-module-registry.ts` |

パスは調査の入口であり、実際の import と呼び出し元で所有者を確認する。`.ts` / `.js` の組がある場合は通常 `.ts` が正本。JS の例外は [docs/typescript-migration-js-allowlist.md](docs/typescript-migration-js-allowlist.md) を参照する。

## ARCHITECTURE

設計上の契約は [docs/architecture-contracts.md](docs/architecture-contracts.md) に集約する。変更に関係する節を参照する。

| 関心事 | 節 |
| --- | --- |
| headless game / UI / Worker / CPU の責務、DI | §4–5、§9 |
| ブラウザ配信入口と生成物 | §5.1.1 |
| 盤面形状・穴・拡張・canonical state | §6 |
| カード使用、pending、ネットワーク入力 | §7.1–7.2 |
| Single Visual Writer、Pixi と DOM fallback、演出の完了 | §7.3 |
| authority、操作の重複処理、再接続、非公開情報、乱数 | §8 |
| 破壊・反転・所有者変更 | §10 |
| root source と生成物・Worker mirror | §11 |
| 検証先の候補 | §12 |

## WORK RULES

- root source を変更し、影響する生成物は既存スクリプトで更新する。`dist/`、生成 catalog を正本として編集しない。ブラウザ生成物・Worker mirror の範囲は設計資料 §5.1.1・§11 を参照する。生成後は差分を確認し、既存の変更や依頼外のアセットを巻き込んでいないことを確かめる。
- 仕様と責務境界に沿い、原因を持つ層と既存 helper で直す。テストを通すためだけに失敗を削除・skip・弱体化しない。
- 誤りや不要になった変更は、新しい編集で上書きする。以前の状態へ戻す目的で Git を使わない（詳細は GIT HYGIENE）。

## VERIFICATION

検証は期待する挙動と変更の影響から選ぶ。必要な検証が通り、未解決の懸念がなければ完了へ進む。新たな変更・失敗・懸念がある場合に再検証や範囲拡大を行う。検証・再現・レビューの回数を一律の完了条件にしない。

| 変更の対象 | 検証の選び方 |
| --- | --- |
| 文書のみ | `git diff --check`、参照先の実在と記述の整合性を確認する。ゲームのビルド・サーバー操作は不要。 |
| ゲームロジック・カード・CPU | 関連する既存テストで期待結果を確認する。既存テストで捉えられない不具合は、その差を検出できる回帰テストを追加する。 |
| 通信・authority | 関連テストと必要な parity 検証を選び、クライアントと authority の両方への影響を確認する。 |
| 描画・入力・演出 | 関連テストに加え、変更した操作や表示を必要な実ブラウザ確認で確かめる。 |
| 生成物・Worker mirror | 正本から生成し、対応する生成・同期チェックを行う。 |

既存テストで十分なら追加は不要。失敗は今回の変更との関係を切り分け、依頼外の問題は根拠と影響を報告する。切り分けできないものや未確認の挙動は、そのまま明示する。

実ブラウザで確認した場合は、URL、Vite/classic、Pixi/DOM compatibility、操作と結果を必要な証拠とともに報告する。HTTP 200 とゲーム操作の成功は別の確認。

## LOCAL DEV SERVER

この節はゲーム変更、ローカルプレイの依頼、サーバーの起動・停止・引き継ぎに適用する。

- 通常のローカルプレイは、この repo の `npm run serve` による `http://127.0.0.1:8000/`。既存の正常なサーバーを再利用し、編集・ビルド・作業完了後も動かしておく。
- 起動・停止前はポートの所有プロセスと対象 repo を確認する。他のプロジェクトのプロセスを停止せず、8001 などへの二重起動を通常 URL の代用にしない。
- サーバーはユーザー／アプリの継続するターミナルか、独立して存続することを確認できるプロセスで起動する。一時的なツールセッションの PID や HTTP 200 だけでは継続動作の証拠にならない。利用可能な手段で継続起動できなければ、未完了の確認事項と `npm run serve` をユーザーに伝える。
- プレイ可能なゲームを変更したら、最終ソースに対して `npm run build:vite` を実行して通常配信へ反映する。これは `build:browser` を含む。8000 のサーバーをビルドのために停止する必要はない。
- ゲーム変更、またはサーバーの起動・停止・引き継ぎを行った作業では、最後に 8000 の HTTP 200、repo のサーバー所有者、継続起動の根拠を確認し、ビルドとサーバーの結果を報告する。失敗した確認は未完了として明示する。
- `npm run dev:vite` の 5174 と `npm run match:server` の 8787 は別用途。5174 で `vite-dist/` を配信中にその出力を再ビルドしない。テスト用の一時サーバーはテストの終了時に片付ける。
- サーブ中の worktree を移動・削除する場合は生存する root へサーバーを引き継ぐ。OS や Codex の再起動を越える自動起動設定は別の依頼として扱う。

## GIT HYGIENE

作業ツリーを整った状態に保つのはエージェントの責任。ユーザーは Git を見ないので、「後で整理する」前提の中間状態を残さない。

### 開始時

- `git status --short` で既存の未コミット変更を把握する。それらは他の作業の進行中の可能性があるので触らず、今回分と分離して進める。
- ビルドや生成スクリプトの出力だけの差分（`index.html` のキャッシュ番号、`public/module-registry*.js`、`shared/*.generated.js`、`assets/asset-manifest.json`、`worker-public/` など）は、他の作業の進行中とはみなさない。今回のビルドで再生成し、今回分のコミットに含める。これを理由にユーザーへ確認しない。
- 所有権が不明な変更を上書きせざるを得ない場合だけ、具体的な衝突を示して確認する。

### 完了時

- 今回の作業で作った・変えたファイルは、すべてコミットして作業ツリーに残さない。新規のテスト・fixture・文書・更新した生成物も含める。
- repo に持つべきでない出力（実験結果、ログ、スクリーンショット、学習データ、一時ファイル）は `.gitignore` に追加し、untracked のまま放置しない。
- 検証が途中で終わった場合も、動作を壊していない範囲で今回分をコミットし、未検証であることをメッセージと報告に明記する。
- 開始時点で他の作業の未コミット変更が残っていたら、完了報告で「別作業の未コミットが N 件残っている」と一言添える。ユーザーが片付けを依頼したら、内容を確認して意味のまとまりごとにコミットするか `.gitignore` に追加する。

### コミット

- 対象は今回の変更だけ。短く具体的なメッセージで、調査・説明・レビューのみではコミットしない。
- ブランチ・タグ・worktree の作成はユーザーが依頼した場合に行う。並行作業では共有仕様と生成物の競合にも注意する。

### 反映（本体 main と GitHub）

- GitHub（`origin`）が唯一のバックアップなので、コミット後に作業ブランチを `git push origin <ブランチ>` で上げるところまでを作業の完了に含める。
- `main` 以外のブランチ（orca などのツールが作る worktree）で作業した場合は、本体 checkout（`F:\Desktop\othello_v2`、`main`）で `git merge --ff-only <ブランチ>` により取り込み、`main` も push する。fast-forward できない、または本体の未コミット変更と衝突する場合は取り込まず、ブランチの push だけ行い、報告で「本体への取り込みは未了」と明記する。
- push が拒否された場合は `git fetch` で差分を確認し、`git merge origin/<ブランチ>` で取り込んでから再度 push する。force push で解決しない。
- 2026-10-06 に本体 `main` と GitHub の系統を統合した経緯と退避場所は [docs/refactor-baselines/history-rewrite-preflight.md](docs/refactor-baselines/history-rewrite-preflight.md) にある。同種の履歴操作はユーザーの明示的な依頼と退避の記録がある場合だけ、別作業として行う。

### 禁止

- 巻き戻し・履歴の書き換え・作業ツリーの破棄はしない。`git reset --hard`、`git checkout -- <file>`、`git restore`、`git stash`、`git clean`、`git rebase`、`git revert`、`--amend`、`push --force` を使わない。
- 無関係な変更の巻き戻し、未追跡ファイルの削除を整理目的で行わない。

## REPORTING

完了報告は次を簡潔に示す。

- 変更内容（プレイヤー視点での挙動の変化を先に）。
- 検証した挙動と結果。失敗・未検証・未完了は明示する。
- ゲーム変更なら、ビルドと 8000 のサーバー状態。
- コミットしたこと、GitHub へ反映したこと。本体 `main` へ取り込めなかった場合や、別作業の未コミットが残る場合はその旨と件数。

## COMMANDS

実際のコマンド定義は [package.json](package.json) を参照する。検証先の候補は [docs/game-maintenance-reference.md](docs/game-maintenance-reference.md) と設計資料 §12 にある。

| 目的 | コマンド |
| --- | --- |
| 全テスト（`pretest` で `checkall` を実行） | `npm test` |
| 限定したテスト | `npm run test:jest -- --runTestsByPath <対象テストのパス>` |
| 型の整合性 | `npm run typecheck` |
| 通常配信へ反映（`build:browser` を含む） | `npm run build:vite` |
| 通常のローカルサーバー（8000） | `npm run serve` |
| Worker mirror の生成 / 検査 | `npm run worker:prepare` / `npm run check:worker-mirror` |
| Worker のローカル実行 / 本番デプロイ | `npm run worker:dev` / `npm run worker:deploy`（`worker:prepare` を含む） |

`worker:prepare`、`check:worker-mirror`、`dev:vite` はブラウザビルドも実行するため、LOCAL DEV SERVER の配信中ビルド制約を確認する。
