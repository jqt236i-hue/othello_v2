# 全面軽量化の実装指示プロンプト（2026-09-24）

役割: 新しい会話の実装担当へ渡す指示。対象・正本・受入条件・制約・作業単位は [全面軽量化計画](ux-preserving-lightweight-plan-2026-09-24.md) が所有する。本ファイルは製品仕様を追加しない。

以下をそのまま実装担当へ渡す。

```text
C:\Users\quarr\Desktop\othello_v2 のカードリバーシを、UX・ゲーム体験・視覚表現・音・タイミングを一切変えずに軽量化してください。計画書 docs/implementation/ux-preserving-lightweight-plan-2026-09-24.md を完遂することが目的です。

## 最初にすること
1. root の AGENTS.md と、触るディレクトリの AGENTS.md / AGENTS.override.md を読む。
2. 計画書を全文読む。§1 の受入条件 A1–A6、§4 の変更境界、§5 の作業単位、§6 の判定規則が完了条件です。計画書の commit は 145394c9d です。
3. `git status --short` と関連差分を確認する。開始時点には前計画（2026-09-08）の残差分（game/ai/cpu-tactical-safety.ts、game/cpu-turn-move-phase.ts、game/cpu-turn-performance.ts、ui/perf-benchmarks.ts、scripts/production-parity-gate.ts、CPU実験ツール、両 asset manifest、生成 HTML/registry、worker-public/ 生成物）と未追跡の制作素材があります。asset manifest・生成物・素材は別作業として保護し、上書きが避けられない場合だけ具体的な衝突を示して確認してください。
4. 8000 の所有プロセスを確認し、既存の正常なサーバーを再利用する。5174 で vite-dist/ を配信中ならビルド前に解決する。

## 進め方
- 計画書 §8 の推奨順序で進める: P0 → P1(a,b,c,d) → P3-a → P2-a → P2-b → P4(a,b,c,f) → P3-b,c → P2-c,d → P4-d → P5(a,b,c,d) → P2-e,P4-e(条件付き) → P6。P1 と P3-a は並行可。
- P0 では、前計画の残差分を typecheck と関連 suite を通してから先に単独コミットし（生成物・manifest は含めない）、別作業の残件（削除済み worker-public/assets/images/special-stones/crystal_stone.png、未追跡素材、DOM compatibility の boot error）を記録し、計測ステージの是正（pending の同期プレフィックスを pending-target-choice に改名し、runCpuPendingSelectionViaPipeline の周りに本物の canonical-commit を置く）を入れてから、§5 P0 の基準を同一 profile・fixture digest・成果物 hash つきで取ってください。基準がない単位を採用判定しないでください。
- 各作業単位は、変更 → 単位ごとの検証 → §6 の判定 → その単位だけのコミット、を繰り返す。依存先へ進む前に検証する。単位ごとに独立して戻せる差分にする。
- 「同一性が先」です。画素・hash 文字列・イベント列と順序・探索の transitions/value/evaluationCalls の一致を確認できない単位は、性能が良くても採用しないでください。画像は画素同一（PNG のアルファ除去は RGB 全画素比較、WebP は既存 admission policy をそのまま通し、却下は PNG のまま残す）。CPU は同一 seed・同一候補順で結果同一。通信は authority 結果・eventId・replay・非公開情報投影が同一。
- 変えないもの: ルール、CPU の判断・候補順・探索上限・打ち切り条件・乱数・思考時間ポリシー、演出の見た目・順序・時間・音、入力、Single Visual Writer、§5.1.1 の起動順と配信契約、§5.2 の Worker preload、authority と §8 の非公開情報。ONNX を有効化しない。非可逆圧縮・ダウンスケール・MP3 再エンコード・SE の遅延 decode・BGM バッファ退避・#log の件数制限は行わない。console.* の一括除去はしない（debug=1 の挙動）。
- 計画書 §2 の「完了済み」と「否定した候補」は再実装・再検討しない。
- 効果のない単位、条件を満たさない条件付き単位（P2-e、P4-e、P5-b の S2）は非採用として数値根拠を計画書 §9 に記録し、成功とは報告しない。n=20 の p95 だけが悪化し中央値が一致する場合は tail として扱い、同条件で再ペア計測してから判定する。
- P4 の parity 再生成（production-parity-gate と production selfplay manifest）は、P4-a〜c の決定同一の証拠を得た後に一度だけ行う。hash 更新のために証拠を弱めない。
- 常時計測・debug 表示を通常経路へ追加しない。新規依存を追加しない。root source を変更し、index.html / index.vite.html / public/module-registry*.js / vite-dist/ / worker-public/ は既存スクリプトで生成する。生成後は差分を確認し、別作業の素材や manifest を巻き込んでいないことを確かめる。
- 命名・局所分割・fixture・回帰テストの追加は任せます。証拠に基づく計画修正は同じ範囲内なら行い、計画書に追記してください。公開契約・非同期境界・CPU 判断・通信の意味・表示やタイミングの意味を変える案や新依存が必要になった場合、または解決不能な検証矛盾が出た場合は §8 に沿ってその単位を設計へ戻し、独立した単位を続けてください。ユーザー確認が必要なのは、素材の削除・移動、別作業差分の上書き、mirror 残件の所有者判断、本番デプロイに限ります。

## 完了時（P6）
- 最終ソースで npm run typecheck と npm test を通し、P0 と同条件で boot / opponent-action / CPU 探索 / 通信保存 / heap を再取得して §6 で判定する。
- npm run build:vite で通常配信へ反映し、npm run worker:prepare と npm run check:worker-mirror を実行する。別作業の残件が mirror を止める場合は、その部分だけ未完了として明示する。
- 実ブラウザで確認する: http://127.0.0.1:8000/?boardRenderer=pixi&debug=1 の通常対局（着手・反転・CPU 応答）、Lv10/11/12 の着手、DOM compatibility（boot error 解消済みの場合）、battleEmbed=1、オンライン対戦のローカル 2 クライアント。URL、Vite/classic、Pixi/DOM、操作と結果を証拠つきで記録する。
- 8000 の HTTP 200、repo のサーバー所有者、継続起動の根拠を確認する。HTTP 成功とプレイ成功は別に記録する。
- git diff --check と git status --short を確認し、計画書 §9 の進捗表を各単位の実測・採否・残件で更新してコミットする。本番デプロイ、長時間訓練、素材整理は行わない。
- 最後に報告する: 単位ごとの変更内容と実測改善（基準値と条件つき）、同一性の証拠、実ブラウザの条件と操作結果、コミット一覧、未検証・未完了・非採用の範囲、別作業の残り。
```
