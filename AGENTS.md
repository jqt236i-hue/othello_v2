# PROJECT KNOWLEDGE BASE

カードリバーシは、ブラウザ UI・headless game logic・network Worker・selfplay/CPU training を同じ repo で扱う JavaScript/TypeScript 中心のゲームです。

## WORKING PRINCIPLES

- ユーザーの目的を満たすため、調査方法、編集順序、検証範囲、計画書やサブエージェントの利用は、依頼内容と変更のリスクに応じて判断する。
- 仕様と責務境界を理解し、原因を持つ層で一貫した変更を行う。既存 helper を活用し、重複実装や将来のためだけの抽象化を増やさない。
- 実装依頼は適切な検証まで進める。調査・説明・レビューのみの依頼では、製品変更やデプロイを行わない。
- 通常の実装判断や検証のために確認を繰り返さない。根拠から解決できない製品仕様の選択や、依頼を大きく超える変更が必要な場合に確認する。
- 作業手順を満たしたことと、要求された挙動が確認できたことを区別する。実行した検証と未検証の範囲、残る問題を率直に報告する。

## SOURCE OF TRUTH

| 情報 | 参照先 |
| --- | --- |
| ゲーム仕様、カード効果、UI 表示・タイミング | [01-rulebook.md](01-rulebook.md) |
| カード・ターン・演出・音の詳細 | [正本/AGENTS.md](正本/AGENTS.md) から該当資料へ |
| 内部構造、authority、runtime 境界 | [docs/architecture-contracts.md](docs/architecture-contracts.md) |
| カード・通信の調査先と検証の候補 | [docs/game-maintenance-reference.md](docs/game-maintenance-reference.md) |
| リポジトリ全体の作業方針 | このファイル |
| ディレクトリ固有の知識・制約 | 対象パスに適用される nested `AGENTS.md` / `AGENTS.override.md` |
| 人間向けの運用判断材料 | [docs/HUMAN-DEV-GUIDE.md](docs/HUMAN-DEV-GUIDE.md)（エージェントは編集しない） |

仕様は話題ごとの正本を参照する。意図された挙動を変える場合は関連仕様も更新し、実装が明確な仕様に反する不具合では実装を直す。内部変更だけならカード仕様や演出資料を書き換える必要はない。

## WHERE TO LOOK

| 対象 | 主な入口 |
| --- | --- |
| Browser boot | `index.html`, `entry-browser.js`, `browser-vite/main.ts`, `browser-vite/pixi-runtime-loader.ts`, `ui/bootstrap.ts` |
| Board visual | `ui/board-visual/controller.ts`, `ui/pixi/board-backend.ts`, `ui/board-dom-compat/` |
| Card rules | `cards/catalog.json`, `src/types/card.ts`, `game/cards/`, `game/logic/cards.ts`, `game/logic/card-resolution/` |
| Turn / pending | `game/turn/turn_pipeline.ts`, `game/turn-manager.ts`, `game/card-effects/` |
| CPU | `game/cpu-decision.ts`, `game/cpu-turn-handler.ts`, `game/ai/`（`cpu/` は compatibility/read-only） |
| Network client | `ui/network-client.ts`, `ui/network/` |
| Network authority | `workers/match-worker.ts`, `scripts/local-match-server.ts`, `utils/match-authority.ts`, `utils/match-command-runtime.ts` |
| Shared contracts | `shared/board/`, `shared/player-encoding.ts`, `utils/owner-helpers.ts`, `constants/` |
| Build / mirror | `package.json`, `scripts/prepare-worker-assets.ts`, `scripts/build-module-registry.ts` |
| Tests | `test/`, `test/e2e/`, `tests/visual-regression/`, `game/ai/__tests__/`, `scripts/__tests__/` |
| Training | `training/scripts/`, `training/python/`, `src/engine/selfplay-runner.ts`（root `scripts/run-selfplay-*.js` は CLI entry） |

パスは調査の入口であり、実際の import と呼び出し元で所有者を確認する。`.ts` / `.js` の組がある場合は通常 `.ts` が正本。JS の例外は [docs/typescript-migration-js-allowlist.md](docs/typescript-migration-js-allowlist.md) を参照する。

## ARCHITECTURE

設計上の契約は [docs/architecture-contracts.md](docs/architecture-contracts.md) に集約する。変更に関係する節を参照する。

| 関心事 | 節 |
| --- | --- |
| headless game / UI / Worker / CPU の責務、DI | §4–5、§9 |
| 盤面形状・穴・拡張・canonical state | §6 |
| カード使用、pending、ネットワーク入力 | §7.1–7.2 |
| Single Visual Writer、Pixi と DOM fallback、演出の完了 | §7.3 |
| authority、操作の重複処理、再接続、非公開情報、乱数 | §8 |
| 破壊・反転・所有者変更 | §10 |
| root source と生成物・Worker mirror | §11 |

## WORK RULES

- root source を変更し、影響する生成物は既存スクリプトで更新する。`dist/`、`worker-public/`、生成 catalog、`public/module-registry.js` を正本として編集しない。
- 検証は変更の影響に合わせて選ぶ。文書だけなら差分・参照先確認、挙動変更なら関連する既存テスト、通信や描画の変更なら必要な parity・実ブラウザ確認を使う。既存の検証で十分なら重複テストを追加しない。
- 不具合は期待結果と実際の差を根拠で示し、修正後にその差が解消したことを確認する。再現回数、レビュー担当数、全体レビューの反復を一律の完了条件にしない。
- テストを通すためだけに失敗を削除・skip・弱体化しない。未確認の挙動を確認済みと報告しない。
- 実ブラウザで確認した場合は、URL、Vite/classic、Pixi/DOM compatibility、操作範囲、エラーや画面・公開 diagnostics の証拠を必要な範囲で報告する。HTTP 200 はゲーム操作の成功とは別の確認。
- 大きな変更や引き継ぎが必要な作業では、次の担当が判断と進捗を追える計画を [docs/AGENTS.md](docs/AGENTS.md) に沿って残す。小さな変更に形式的な計画書は不要。
- 長時間の selfplay・訓練、本番デプロイ、課金を伴う操作はユーザーの依頼に含まれる場合に行う。秘密情報は出力・文書・コミットに含めない。

## LOCAL DEV SERVER

- 通常のローカルプレイは、この repo の `npm run serve` による `http://127.0.0.1:8000/`。既存の正常なサーバーを再利用し、編集・ビルド・作業完了後も動かしておく。
- 起動時はポートの所有プロセスと対象 repo を確認する。他のプロジェクトのプロセスを停止せず、8001 などへの二重起動を通常 URL の代用にしない。
- サーバーはユーザー／アプリの継続するターミナルか、独立して存続することを確認できるプロセスで起動する。一時的なツールセッションの PID や HTTP 200 だけでは継続動作の証拠にならない。利用可能な手段で継続起動できなければ、未完了の確認事項と `npm run serve` をユーザーに伝える。
- プレイ可能なゲームを変更したら、最終ソースに対して `npm run build:vite` を実行して通常配信へ反映する。これは `build:browser` を含む。8000 のサーバーをビルドのために停止する必要はない。
- ゲーム変更、またはサーバーの起動・停止・引き継ぎを行った作業では、最後に 8000 の HTTP 200、repo のサーバー所有者、継続起動の根拠を確認し、ビルドとサーバーの結果を報告する。失敗した確認は未完了として明示する。文書のみの変更でゲームの再ビルドは不要。
- `npm run dev:vite` の 5174 と `npm run match:server` の 8787 は別用途。5174 で `vite-dist/` を配信中にその出力を再ビルドしない。テスト用の一時サーバーはテストの終了時に片付ける。
- サーブ中の worktree を移動・削除する場合は生存する root へサーバーを引き継ぐ。OS や Codex の再起動を越える自動起動設定は別の依頼として扱う。

## GIT HYGIENE

- 作業開始時と完了前に `git status --short` と関連差分を確認する。既存の変更は別タスクの作業かもしれないので保護する。
- 無関係な変更があっても、今回の変更を安全に分離できるなら進める。同じ箇所の所有権が不明で上書きが避けられない場合に限り、具体的な衝突を示して確認する。
- ブランチ・タグ・worktree の作成はユーザーが依頼した場合に行う。並行作業では共有仕様と生成物の競合にも注意する。
- ステージ・コミットの対象は今回の変更だけに限定する。無関係な変更の巻き戻し、未追跡ファイルの削除、破壊的な Git 操作を整理目的で行わない。

## COMMIT POLICY

依頼された実装・修正・文書更新が検証済みのまとまった差分になったら、今回の変更だけをコミットする。コミットメッセージは短く具体的にする。調査・説明・レビューのみではコミットしない。

未解決の不具合や分離できない変更がある場合は、その理由と未完了部分を報告する。完了報告では変更内容、実施した検証、コミット、残る問題を示す。別タスクの変更が残っている場合も明示する。

## COMMANDS

実際のコマンド定義は [package.json](package.json) を参照する。検証先の候補は [docs/game-maintenance-reference.md](docs/game-maintenance-reference.md) と設計資料 §12 にある。

- `npm test` は `pretest` で `checkall` を実行する。限定した検証には対象の Jest テストを選べる。
- `npm run worker:dev` / `npm run worker:deploy` は `worker:prepare` を含む。mirror の単独生成・検査には `worker:prepare` と `check:worker-mirror` を使う。
- プレイヤー向けの報告では画面や仕様書の日本語表示名を優先する。
