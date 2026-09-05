# PROJECT KNOWLEDGE BASE

カードリバーシは、ブラウザ UI・headless game logic・network Worker・selfplay/CPU training を同じ repo で扱う JavaScript/TypeScript 中心のゲームです。

このファイルは全体に適用する制約と参照先を定めます。対象パスに適用される `AGENTS.md` / `AGENTS.override.md` を確認し、仕様・内部契約は変更に関係する箇所だけ参照してください。索引は読み込み一覧や実行順序ではありません。

## WORKING PRINCIPLES

- 実装依頼は、要求された挙動の実装、影響に応じた検証、今回の変更に起因する不具合の修正まで進める。プレイ可能なゲームの変更は、下記の通常配信への反映までを完了に含む。
- 依頼の範囲内の調査・編集・ローカル検証・修正後の再検証は、その都度の承認を求めず進める。資料と実装から解決できない製品仕様の選択や、大きな範囲拡張は確認する。待っている間も独立して進められる作業は続ける。
- 調査・説明・レビューだけの依頼は、その結果の提示を完了とする。製品変更やデプロイは含めない。
- 調査方法や編集順序は任せる。計画書は、大きな変更や引き継ぎで判断・進捗を残す必要がある場合に [docs/AGENTS.md](docs/AGENTS.md) に沿って作る。
- プレイヤー向けの説明・報告では画面や仕様書の日本語表示名を優先する。

## SOURCE OF TRUTH

| 情報 | 参照先 |
| --- | --- |
| ゲーム仕様、カード効果、UI 表示・タイミング | [01-rulebook.md](01-rulebook.md) |
| カード・ターン・演出・音の詳細 | [正本/AGENTS.md](正本/AGENTS.md) から該当資料へ |
| 内部構造、authority、runtime 境界 | [docs/architecture-contracts.md](docs/architecture-contracts.md) |
| カード・通信の調査先と検証の候補 | [docs/game-maintenance-reference.md](docs/game-maintenance-reference.md) |
| 人間向けの運用判断材料 | [docs/HUMAN-DEV-GUIDE.md](docs/HUMAN-DEV-GUIDE.md)（エージェントは編集しない） |

資料と実装が食い違う場合は、関連仕様と変更履歴から意図を判断する。仕様変更は一次情報と該当する詳細仕様に反映し、明確な仕様違反は実装を直す。内部変更だけならカード仕様や演出資料の更新は不要。

## WHERE TO LOOK

| 対象 | 主な入口 |
| --- | --- |
| Browser boot | `index.html`, `entry-browser.js`, `browser-vite/main.ts`, `browser-vite/pixi-runtime-loader.ts`, `ui/bootstrap.ts` |
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
| 盤面形状・穴・拡張・canonical state | §6 |
| カード使用、pending、ネットワーク入力 | §7.1–7.2 |
| Single Visual Writer、Pixi と DOM fallback、演出の完了 | §7.3 |
| authority、操作の重複処理、再接続、非公開情報、乱数 | §8 |
| 破壊・反転・所有者変更 | §10 |
| root source と生成物・Worker mirror | §11 |

## WORK RULES

- root source を変更し、影響する生成物は既存スクリプトで更新する。`dist/`、`worker-public/`、生成 catalog、`public/module-registry.js` を正本として編集しない。
- 仕様と責務境界に沿い、原因を持つ層と既存 helper で直す。テストを通すためだけに失敗を削除・skip・弱体化しない。
- 長時間の selfplay・訓練、本番デプロイ、課金を伴う操作はユーザーの依頼に含まれる場合に行う。秘密情報は出力・文書・コミットに含めない。

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
- 起動時はポートの所有プロセスと対象 repo を確認する。他のプロジェクトのプロセスを停止せず、8001 などへの二重起動を通常 URL の代用にしない。
- サーバーはユーザー／アプリの継続するターミナルか、独立して存続することを確認できるプロセスで起動する。一時的なツールセッションの PID や HTTP 200 だけでは継続動作の証拠にならない。利用可能な手段で継続起動できなければ、未完了の確認事項と `npm run serve` をユーザーに伝える。
- プレイ可能なゲームを変更したら、最終ソースに対して `npm run build:vite` を実行して通常配信へ反映する。これは `build:browser` を含む。8000 のサーバーをビルドのために停止する必要はない。
- ゲーム変更、またはサーバーの起動・停止・引き継ぎを行った作業では、最後に 8000 の HTTP 200、repo のサーバー所有者、継続起動の根拠を確認し、ビルドとサーバーの結果を報告する。失敗した確認は未完了として明示する。
- `npm run dev:vite` の 5174 と `npm run match:server` の 8787 は別用途。5174 で `vite-dist/` を配信中にその出力を再ビルドしない。テスト用の一時サーバーはテストの終了時に片付ける。
- サーブ中の worktree を移動・削除する場合は生存する root へサーバーを引き継ぐ。OS や Codex の再起動を越える自動起動設定は別の依頼として扱う。

## GIT HYGIENE

- 作業開始時と完了前に `git status --short` と関連差分を確認し、既存の変更を保護する。今回分を分離できるなら進め、所有権が不明な変更の上書きを避けられない場合だけ、具体的な衝突を示して確認する。
- ブランチ・タグ・worktree の作成はユーザーが依頼した場合に行う。並行作業では共有仕様と生成物の競合にも注意する。
- ステージ・コミットの対象は今回の変更だけに限定する。無関係な変更の巻き戻し、未追跡ファイルの削除、破壊的な Git 操作を整理目的で行わない。

## COMMIT POLICY

依頼された実装・修正・文書更新が検証済みになったら、今回の変更だけを短く具体的なメッセージでコミットする。調査・説明・レビューのみではコミットしない。

完了報告は、変更内容、検証した挙動と結果、コミット、未検証・未完了の範囲を簡潔に示す。別タスクの変更が残る場合も明示する。

## COMMANDS

実際のコマンド定義は [package.json](package.json) を参照する。検証先の候補は [docs/game-maintenance-reference.md](docs/game-maintenance-reference.md) と設計資料 §12 にある。

- `npm test` は `pretest` で `checkall` を実行する。限定した検証には対象の Jest テストを選べる。
- `npm run worker:dev` / `npm run worker:deploy` は `worker:prepare` を含む。mirror の単独生成・検査には `worker:prepare` と `check:worker-mirror` を使う。
