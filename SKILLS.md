# カードリバーシ / SKILLS.md

最終更新: 2026-07-11

## 0. この文書の役割

- この文書は、Codex skill の索引と選び方だけを置く場所です。
- repo-wide rule は `01-rulebook.md`, `docs/architecture-contracts.md`, `AGENTS.md`, nested `AGENTS.md` が担当します。
- この repo には現時点で `.github/skills/`, `.github/instructions/`, `.github/agents/` はありません。存在しない `.github/*` パスを正本として扱わないでください。
- 実行環境に読み込まれている skill の手順本文は、Codex が提示する skill path の `SKILL.md` を読みます。

## 1. どの文書を見るか

| 欲しい情報 | 見る場所 |
| --- | --- |
| ゲーム仕様 / UI 表示仕様 | `01-rulebook.md` |
| 内部構造 / runtime 境界 | `docs/architecture-contracts.md` |
| 調査順 / 編集順 / 確認順 | `AGENTS.md` |
| フォルダ別の差分ルール | nested `AGENTS.md` |
| 局所メモ | `README.ai.md` |
| Codex skill の手順 | Codex が提示する skill path の `SKILL.md` |

## 2. skill を使う場面

- 同じ種類の作業が繰り返し出る時
- 複数ファイルにまたがる定型調査と検証束がある時
- 既知の罠があり、読む順と確認順を固定したほうが安全な時
- 一度きりの局所ルールなら、skill より nested `AGENTS.md` や `README.ai.md` を優先する
- 構造問題や再発不具合で責務境界ごと直す時は、先に設計・計画を切ってから実装する

## 3. 現在使う repo 向け skill

この一覧は、この repo で特に有効な Codex skill の選び方です。実際に使えるかは、そのセッションで提示される skill metadata を正としてください。

| Skill | 使う時 |
| --- | --- |
| `goal-prompter` | 長期的な目的を、リポジトリや現状を先に調べたうえで、現在のメインチャット内で検証可能な Codex Goal に整え、明示された場合だけ有効化する時 |
| `harsh-critic` | コード、文書、デザイン、設定、計画などの具体的な成果物に対して、辛口で欠点を洗い出すレビューを求められた時 |
| `card-reversi-card-change` | カードの追加・変更・削除を分類し、既存参照の棚卸し、専門 skill への振り分け、仕様・logic・presentation・network・生成物の横断検証を行う時 |
| `card-reversi-network-contract` | network command、authority、snapshot、reconnect、pending、playback、Worker/local parity を変更・診断・検証する時 |
| `card-reversi-browser-new-card` | ブラウザ版の新カードを catalog / headless effect / pending selection / CPU / presentation / docs / tests まで end-to-end で追加する時 |
| `card-reversi-browser-card-change` | ブラウザ版の既存カードの挙動、target、timing、availability、CPU 影響、presentation、rules help を変更する時 |
| `card-reversi-browser-card-text-change` | ブラウザ版の既存カードの表示名、簡易説明、詳細説明、help copy だけを変え、ゲーム挙動は変えない時 |
| `card-reversi-browser-cost-change` | ブラウザ版の既存カードの cost 数値だけを変え、catalog / generated projection / UI / docs / focused tests をそろえる時 |
| `card-reversi-browser-live-network-check` | ブラウザ版の本番 network battle を Chrome + Edge の実ブラウザ分離で確認する時 |
| `card-reversi-unity-ui-change` | Unity 版 `C:\Users\quarr\Documents\CARD-REVERSI` の UI / scene presentation / animation / audio / DebugSandbox 表示を変更する時 |
| `safe-refactor-lifecycle` | 挙動を保った整理、重複解消、helper 抽出、ファイル分割、dead code 除去を行う時 |
| `repo-instruction-auditor` | `AGENTS.md`, `SKILLS.md`, `README.ai.md`, repo-local skill など AI 向け指示文書を監査・更新する時 |

## 4. 選び方の近道

- 長期タスクを監査可能な Codex Goal にする: `goal-prompter`
- カード変更の分類・参照棚卸し・横断検証: `card-reversi-card-change`
- network authority / snapshot / parity の変更・診断: `card-reversi-network-contract`
- ブラウザ版の新カード追加: `card-reversi-browser-new-card`
- ブラウザ版の既存カード仕様変更: `card-reversi-browser-card-change`
- ブラウザ版の既存カード文言だけ変更: `card-reversi-browser-card-text-change`
- ブラウザ版の既存カード cost だけ変更: `card-reversi-browser-cost-change`
- ブラウザ版の本番 network battle 確認: `card-reversi-browser-live-network-check`
- Unity 版の UI / presentation 変更: `card-reversi-unity-ui-change`
- 挙動維持の refactor / cleanup: `safe-refactor-lifecycle`
- 辛口のダメ出しレビュー: `harsh-critic`
- AI 向け instruction / skill index の棚卸し: `repo-instruction-auditor`

## 5. 補足

- skill は repo-wide rule を再定義しません。まず上位文書の境界を守ります。
- `worker-public/`, `dist/`, generated catalog, `public/module-registry.js` を直接正本扱いせず、必要な時だけ既存 script で同期します。
