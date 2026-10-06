---
status: complete
scope: phase-h-history-rewrite
created: 2026-07-11
updated: 2026-07-11
---

# Phase H Git 履歴書き換え事前検証

## 結論

`artifacts/**` を全履歴から除去する履歴修復は完了した。書き換え前後の最新 tree hash は同一であり、型検査、境界検査、match/network parity、browser/Worker 生成、visual regression は権威リモートからの新規クローンで通過した。

二回目の明示承認後、権威リモート `origin/main` は `--force-with-lease` で更新済みである。書き換え前の完全bundleと旧checkoutはrollback用に保持している。

## 対象と承認

- 権威リモート: `https://github.com/jqt236i-hue/othello_v2.git`
- 対象 ref: `refs/heads/main` のみ
- リモートタグ: 0 件
- リモート `main`（採取時）: `3ba2b21ecebea458c7a92da48057f5ecd6d79e2d`
- ドライラン開始時のローカル `main`: `90e49e887365e24c50260ceccd8d3fcf77ae65c5`
- CRLF 検証修正後のローカル `main`: `b4619a00fe15dff8d4e8158ecaf8a48e976ad6a8`
- ローカルはリモートより 1,957 コミット先行し、リモート固有コミットは 0 件だった。よって、最終候補はリモート clone ではなくローカル `main` の完全履歴から生成する。
- ユーザーは 2026-07-11 に Phase H の隔離ドライラン、バックアップ、ブラウザ検証を含む残作業を承認した。
- ドライラン証拠を提示した後、ユーザーは 2026-07-11 に「全て承認」と回答し、Phase H.2 の二回目の明示承認を行った。

## 使用ツールと隔離

- Git: `2.50.1.windows.1`
- `git-filter-repo`: `2.47.0`（version commit `a40bce548d2c`）
- ツールは `C:\Users\quarr\Desktop\othello_v2-phase-h-dry-run-20260711\tooling` の隔離 venv に導入した。グローバル環境は変更していない。
- mirror、bundle、validation clone はすべて `C:\Users\quarr\Desktop\othello_v2-phase-h-dry-run-20260711` 配下に置き、正本 checkout では履歴書き換えを実行していない。
- Codex 内部 ref を公開候補へ混入させないため、bare repository には `refs/heads/main` だけを明示 fetch した。

## バックアップ

- 初回 bundle: `pre-filter-main.bundle`
- 対象 SHA: `90e49e887365e24c50260ceccd8d3fcf77ae65c5`
- サイズ: 5,217,290,561 bytes
- SHA-256: `07136C2F9D601B6CDB1A7215FF403FC03D375F0F6AEB4C179844E32EA1340EB6`
- `git bundle verify` は「complete history」として成功した。
- 最終 bundle: `final-pre-rewrite-main-6a4383659.bundle`
- 最終 pre-rewrite SHA: `6a4383659110a3f0e2c22aabb82f266aa2b15d5f`
- 最終 bundle サイズ: 5,221,407,417 bytes
- 最終 bundle SHA-256: `C7FA66E69027125818B8E9F3826CA61A4FD400F57294FBDC89EA23614FF85F0A`
- 最終 bundle も `git bundle verify` で「complete history」として成功した。初回 bundle は削除せず二重化している。

## 書き換え方法

保持ポリシーの正本どおり、除去対象は `artifacts/**` だけとした。

```powershell
git-filter-repo --path artifacts --invert-paths --force
```

タグ、他ブランチ、任意の大容量ファイル、ソース、生成物を追加除去する条件は加えていない。

## ドライラン結果

| 指標 | 書き換え前 | 書き換え後 |
| --- | ---: | ---: |
| `main` コミット数 | 2,161 | 2,157 |
| unique historical `artifacts/**` paths | 156,453 | 0 |
| `rev-list --objects` の `artifacts/**` 行 | 存在 | 0 |
| pack size | 4.86 GiB（`main` だけの比較用 bare candidate） | 1.60 GiB |
| fresh-clone `.git` size | 未採取 | 1,726,478,680 bytes |
| latest tree | `fe7d40287a928226cf80be575d8b2c7d31e7d315` | `fe7d40287a928226cf80be575d8b2c7d31e7d315` |

- dry-run rewritten `main`: `aeb97a4f90cfca96078fa0d49379c97e3d4ffb0f`
- 書き換え前の正本 checkout 全体は、内部・remote ref と loose objects を含め 5.26 GiB だった。比較用 candidate は公開対象の `main` だけを保持したため 4.86 GiB である。
- `git fsck --full`: PASS
- retained refs: `refs/heads/main` 1件
- retained tags: 0件
- tree hash が一致するため、最新スナップショットの全 tracked file 内容とモードは書き換え前後で同一である。
- 4コミット減は、`artifacts/**` だけを持っていたコミットが空になり `git-filter-repo` により除去された結果である。

## 書き換え後の新規クローン検証

検証順序は `npm ci` → `npm run build:browser` → `npm run worker:prepare` → 検査群とした。クリーンクローンでは `dist/` が存在しないため、`checkall` より先に TypeScript build を含む生成コマンドが必要である。

| コマンド | 結果 |
| --- | --- |
| `npm ci` | PASS。既存 lockfile に対し 394 packages を導入 |
| `npm run build:browser` | PASS。registry 787 modules |
| `npm run worker:prepare` | PASS。mirror 890 files |
| `npm run checkall` | PASS。dependency、headless、artifact retention、Worker mirror、JS inventory を含む |
| `npm run test:match:parity` | PASS。11 suites / 142 tests |
| `npm run test:network:parity` | PASS。34 suites / 516 tests |
| `npm run test:visual` | PASS。diff 0 pixels |

### ドライランで検出して修正した事項

- Windows の新規 clone では `scripts/local-match-server.ts` が CRLF になり、テストが LF 固定の正規表現で関数本体を抽出できなかった。
- 実装挙動には関係しない。`test/local-match-server.publish-contract.test.ts` の抽出を LF/CRLF 両対応にし、`b4619a00f` としてコミットした。
- 修正後は focused 23/23、match parity 142/142、network parity 516/516 が Windows 新規 clone で PASS した。

### 既知の非ブロッキング事項

- `npm ci` は 12 vulnerabilities（2 low / 5 moderate / 4 high / 1 critical）を報告した。依存監査の既存課題であり、履歴書き換え差分ではない。自動 `npm audit fix` は挙動変更リスクがあるため実行していない。
- `npm run test:network:parity` は既知の Jest open-handle 警告を出す場合があるが exit code は 0 で全516件 PASSした。
- visual runner は Node の `url.parse()` deprecation warning を出したが、画像差分は 0 pixels で exit code は 0 だった。
- Windows fresh clone では改行正規化のため `build:browser` が6個の cache-buster 生成物を更新した。生成後の `checkall` と全検証は PASSし、ゲームソースの差分ではない。これらの disposable clone 差分は push 対象にしない。

## H.2 の実行ゲート

二回目の明示承認後も、次を満たさなければ push しない。

1. `git fetch --prune origin` 後、`origin/main` が期待 SHA のままである。
2. 正本 checkout が clean で、ローカル `main` に未記録の変更がない。
3. 最新 pre-rewrite `main` の完全 bundle を新規作成し、`git bundle verify` と SHA-256 を記録する。
4. 最新 `main` から新しい bare candidate を作り、同じ filter を再実行する。
5. 書き換え前後の最新 tree hash が一致し、履歴内 `artifacts/**` が0件である。
6. `--force` ではなく、採取済み old remote SHA を指定する `--force-with-lease` を使う。

予定する push 形式は次のとおり。`<old-remote-sha>` と `<candidate>` は H.2 直前の再採取値を使う。

```powershell
git -C <candidate> push --force-with-lease=refs/heads/main:<old-remote-sha> https://github.com/jqt236i-hue/othello_v2.git refs/heads/main:refs/heads/main
```

## 協力者の復旧手順

### force-push 前

1. 未コミット変更がある協力者は作業を止め、`git status` と `git diff` を保存する。
2. 公開していないローカルコミットは SHA と基点を記録し、必要なら `git format-patch` で外部ディレクトリへ退避する。
3. 自動 deploy、PR merge、bot push を停止し、`main` への同時 push がない時間帯を確保する。

### force-push 後（推奨）

1. 既存 clone を削除・resetせず、別名で保持する。
2. 権威リモートから新しいディレクトリへ fresh clone する。
3. 必要な未公開変更だけを patch または手作業で移植し、旧履歴の merge commit を新履歴へ持ち込まない。
4. `npm ci`、生成コマンド、対象テストを新 clone で実行する。

### リモート rollback

push 後の fresh-clone 検証が失敗した場合は新規変更を止め、H.2 で記録する final pre-rewrite SHA と完全 bundle から `main` を復元する。rollback も、現在の rewritten SHA を lease に指定した `--force-with-lease` で行う。具体 SHA は H.2 の最終欄へ記録してから実行する。

## H.2 最終記録

- 二回目の承認: 2026-07-11、ユーザー回答「全て承認」
- old remote `main`: `3ba2b21ecebea458c7a92da48057f5ecd6d79e2d`
- final pre-rewrite `main`: `6a4383659110a3f0e2c22aabb82f266aa2b15d5f`
- final pre-rewrite tree: `5ee8e71af63eb2ff32a81f9a7902185bc9d72640`
- pushed rewritten `main`: `7d700fe4be4242c072fe43965e41481d78ac59df`
- rewritten tree: `5ee8e71af63eb2ff32a81f9a7902185bc9d72640`（pre-rewrite と一致）
- push: `--force-with-lease=refs/heads/main:3ba2b21ecebea458c7a92da48057f5ecd6d79e2d` で成功
- authoritative fresh clone refs: `main` / `origin/main` ともに `7d700fe4be4242c072fe43965e41481d78ac59df`、タグ0件
- authoritative fresh clone: 2,158 commits、pack 1.60 GiB、`.git` 1,725,197,744 bytes
- authoritative history: `artifacts/**` path 0件、object line 0件、`git fsck --full` PASS
- authoritative checks: `npm ci`、`build:browser`、`worker:prepare`、`checkall`、match parity 142/142、network parity 516/516、visual diff 0 pixels がすべて PASS
- recovery status: 復旧手順を本書に掲載し、旧checkout・初回bundle・最終完全bundle・書き換え済み候補を隔離領域に保持している。個別の外部協力者通知先は提供されていないため、次回利用者は既存cloneを再利用せずfresh cloneする。

## 2026-10-06 系統統合の記録

Phase H.2 の push 後、ローカルの本体 `main`（`F:\Desktop\othello_v2`）は書き換え前の系統（`6a4383659` の子孫）のまま作業が続き、GitHub（`origin/main`）は書き換え後の系統（`7d700fe4b` の子孫）に別の作業が積まれていた。ユーザーの依頼（2026-10-06「お願いします」、本体を正として GitHub を合わせる旨を事前説明済み）に基づき、次のとおり統合した。

- 退避: 全 ref の bundle `C:\Users\quarr\othello_v2-git-backup\othello_v2-all-refs-2026-10-06.bundle`（6,443,719,141 bytes、`git bundle verify` 成功）。ローカル ref `refs/backup/2026-10-06/{main,origin-main,kadoriba,boxfish}`。
- 統合前: 本体 `main` = `31ad41c7e`（旧系統、`6a4383659` 以降 767 commits、merge なし、`artifacts/**` 変更なし）。`origin/main` = `32897c4ff`。worktree `Kansoku111/カドリバ調整` = `c4b3f80f7`（`origin/main` + 3 commits）。
- 方法: 一時 worktree で `git rebase --onto 7d700fe4b 6a4383659 --committer-date-is-author-date`。`6a4383659` と `7d700fe4b` の tree は同一（`5ee8e71a`）のため競合なし。1 commit が Windows 上で一時的に失敗し `--continue` で再開。
- 結果: 新 `main` = `fa0e071ba`。tree は旧 `31ad41c7e` と同一。`7d700fe4b` 以降 767 commits。`artifacts/**` を触る commit 0 件。
- push: `--force-with-lease=refs/heads/main:32897c4ff` で成功。blobless clone で `origin/main` = `fa0e071ba`、commit 数 2,925、`artifacts/**` 0 件、タグ 0 件を確認。
- `origin/main` 側にだけあった 4 commits の扱い: `d5468b66a` / `32897c4ff`（Phase H 完了記録と承認規約）は本書・計画書・program-baseline へ内容を移植し、AGENTS.md は本体の新版に統合済み。`96d9c7a67` / `d38e0df17`（持ち石ルール・持ち石切れ）は本体で独立に実装済み（`test/game.stone-supply.test.ts` が終局条件を含む）のため移植不要。`c4b3f80f7`（盤面縮小神 コスト27→35）は本体へ再適用。
- 旧系統の退避: `Kansoku111/カドリバ調整` 旧先端は生成物差分を `8709fbf97` として退避し `refs/backup/2026-10-06/kadoriba` が指す。worktree `boxfish`（`Kansoku111/rename-naming-alt-hyperactive`、`b8ff4bac4`、旧系統上に 61 commits）は未統合。取り込む時は `git rebase --onto fa0e071ba 31ad41c7e` 相当の載せ替えが必要。
- 復旧: bundle から `git fetch <bundle> refs/backup/2026-10-06/main` で旧 `main` を取り出せる。GitHub を旧状態へ戻す必要があれば `32897c4ff` を対象に、現在の `fa0e071ba` を lease に指定して push する。
