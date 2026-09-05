# ネット対戦の内部最適化・検証記録

役割: 2026-09-05 の実装・検証記録。対象はネット対戦の保存、履歴、通信、クライアント状態管理。継続する内部契約の正本は [architecture-contracts.md](../architecture-contracts.md)。ゲームルール、表示、演出順・時間・音、入力再開条件、履歴保持数は変更していない。本番デプロイと別作業の訓練停止は対象外。

## 実装

1. `workers/match-room-storage.ts`: 部屋の現在状態と、演出・SSE履歴を別キーへ保存。現在状態、新規履歴、期限切れ履歴の削除を同一transactionで確定し、変更されない履歴の再コピー・再書き込みを除去した。旧単一キー形式を読み込み、保存時に移行する。保存失敗時はWorkerの推測状態を破棄し、次回は最後に確定した状態を読む。
2. `shared/immutable-data.ts` と履歴生成処理: 私有のコピーを再帰的に変更不可にし、所有権を確認できる内部データだけ再利用する。単なるshallow freezeは信頼しない。公開用frameは1操作・閲覧権限ごとに作成し、HTTPとSSEで再利用する。
3. `shared/playback-event-codec.ts`: V3対応を明示した接続には、演出イベントのキーを辞書化する可逆圧縮を使う。サイズが減らない場合は完全なイベント配列を残す。V2と非対応クライアントの形式を維持し、保存履歴は圧縮しない。破損した辞書や二重指定は拒否する。
4. クライアントの確定状態登録では、検証済みの私有・変更不可snapshotを再利用する。ゲームが変更する状態、表示途中の状態、外部向けコピーは分離を維持する。
5. タイマーの同一tick内の二重通知を1回へ整理する。通常1秒、残り10秒の250ms間隔、締切・再同期の意味は維持する。
6. 観戦者等へ同じSSEを送る際は、同一payload・形式・イベントIDのバイト列を1配信内で再利用する。異なる閲覧権限や形式では共有しない。

## 性能測定

再現スクリプトは `scripts/perf/measure-network-storage.ts`。ビルド後 `node dist/scripts/perf/measure-network-storage.js` で再測定できる。実際の履歴作成関数を使い、同規模の履歴を8件保持する合成ストレス条件。自然な対戦8手の再現ではない。書き込み量はJSON換算で、Cloudflareの物理保存量や回線圧縮後の転送量ではない。

| 局面 | 従来の部屋全体 | 新しい履歴を追加する保存 | 履歴が変わらない保存 | 通信 V2 → V3 |
| --- | ---: | ---: | ---: | ---: |
| 軽い局面 | 397,620 B | 83,276 B | 21,928 B | 6,115 → 6,115 B |
| 密集局面 | 706,212 B | 125,589 B | 24,240 B | 10,365 → 9,312 B |
| 特殊石20個・42イベント | 3,175,945 B | 449,074 B | 33,405 B | 44,546 → 30,906 B |

特殊石の条件では、新規履歴を追加する保存量が約86%、履歴が変わらない保存量が約99%、V2比の通信量が約31%減少した。履歴を追加する保存は現在状態・演出履歴・SSE履歴の3キーを書き込む。保持する履歴数とイベント内容は同じで、総メモリ使用量が同率で減るという意味ではない。

Windows / Node v24.12.0、warmup10回・60回採取。最後の測定で特殊石条件の従来の部屋コピー中央値47.06ms、変更なし保存の前処理中央値0.86ms。transactionはディスクI/Oのない代替であり、本番の操作応答時間ではない。別作業の訓練とのCPU競合があり、先行測定では29.48ms / 0.46msだった。安定した効果の根拠としてはバイト数・処理回数を優先する。

圧縮処理にも費用はある。同じ最終測定の特殊石条件で、V2生成＋JSON化の中央値0.15ms、V3は0.60ms、V3解析＋完全復元は0.69ms。通信量減少と引き換えの小さな計算増であり、端末・回線による体感改善率は未確定。純粋なハッシュ処理のコピー除去、描画品質低下、演出短縮は今回行っていない。

生データはローカルの `artifacts/network-audit-20260905/optimized-storage.json`、調査時の根拠は同ディレクトリの `findings.md`。

## 検証結果

- 追加・関連テスト: 8 suites / 73 tests、続いてHTTP/SSEのV2/V3、観戦・旧保存形式等の5 suites / 16 testsが成功。
- `npm run test:network:parity`: 36 suites / 589 testsが成功。終了時に既存の未終了非同期処理に関するJest警告が出たが終了コードは0。
- `npm run typecheck`: ブラウザ・Worker・テストを含む型検査とtraining型検査が成功。
- 実Chromium: `network-battle-complete-smoke.test.ts` と `network-special-stone-late-game.e2e.test.ts` の2件が成功。生成済みVite入口 / Pixiを一時ローカルURLで配信。通常着手、切断復帰後の続行、黒・白・観戦者の終盤演出、途中で最終盤面を先行表示しないこと、最終盤面・特殊石・公開範囲・一度だけの演出実行を確認。テスト用ブラウザとサーバーは終了済み。
- `npm run match:check`: `http://127.0.0.1:64671` で作成・参加・再参加・SSE・着手・退出が成功し、一時サーバーを終了。
- Worker: 通常のbundle smokeは別作業の28.8MiBの `observer_will_reference/blender_model_v2/Observer_Will.blend` が静的アセット上限を超えて停止した。素材は保持。検証スクリプトのassertionを維持し、Wranglerの `--assets` だけを空の一時ディレクトリへ変更した検証コピーで、bundle内の特殊石・自動手番・継続配置・失敗時原子性と、実ローカルDurable Objectの作成・参加・取得・V3着手・同一操作再送・退出が成功した。URLは `http://127.0.0.1:51271`。これはAPIの検証であり、全アセットを含む公開可能性の検証成功ではない。
- `npm run build:vite` 成功。既存の大きいchunkに関する警告は残る。Worker mirrorは既存素材を消さない設定で正本から生成し、置換された旧Vite bundleだけを退避・除去。`check-worker-mirror.js` は1,610ファイルで成功。アセット名、runtime preload、`check:window`、`git diff --check` も成功。
- 通常URL `http://127.0.0.1:8000/?debug=1&boardRenderer=pixi`: HTTP 200、Vite / Pixi、canvas 1個、V3、pageerrorなしで起動。`normal-url.json` と `normal-url.png` にローカル証拠を保存。8000はrepoを指す既存http-server PID35252、親はserve-with-fallback PID35792で、13:17から継続するプロセスを再利用した。

## 適用と残る範囲

通常ローカル配信へ反映済み。本番デプロイ、物理スマホ、実回線での操作遅延、GPUの前後比較は未検証。本番のすべての「重さ」が解消したとの主張はしない。見た目の同一性はイベント完全復元と通し挙動で確認しており、全場面のピクセル差分検査ではない。

保存形式を読み込めない旧Workerへ戻す際は、保存データの移行が必要。現設定はSQLite-backed Durable Objectsであり、保存上限は [Cloudflare公式制限](https://developers.cloudflare.com/durable-objects/platform/limits/) を参照する。通常の全アセットbundle検証は上記の別作業素材のため未完了であり、本番配信前に制作原本の配信範囲を整理する必要がある。

開始時から存在したAGENTS.md、asset-manifest、画像・モデル等の変更は今回のコミットに含めない。
