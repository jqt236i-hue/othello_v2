---
status: dry-run-complete
scope: phase-h-history-rewrite
created: 2026-07-11
updated: 2026-07-11
---

# Phase H Git 履歴書き換え事前検証

## 結論

`artifacts/**` を全履歴から除去する隔離ドライランは成功した。書き換え前後の最新 tree hash は同一であり、型検査、境界検査、match/network parity、browser/Worker 生成、visual regression は書き換え後の新規クローンで通過した。

権威リモートへの push はまだ行っていない。`origin` の `main` を書き換えるには、本書の結果を確認した後の二回目の明示承認が必要である。

## 対象と承認

- 権威リモート: `https://github.com/jqt236i-hue/othello_v2.git`
- 対象 ref: `refs/heads/main` のみ
- リモートタグ: 0 件
- リモート `main`（採取時）: `3ba2b21ecebea458c7a92da48057f5ecd6d79e2d`
- ドライラン開始時のローカル `main`: `90e49e887365e24c50260ceccd8d3fcf77ae65c5`
- CRLF 検証修正後のローカル `main`: `b4619a00fe15dff8d4e8158ecaf8a48e976ad6a8`
- ローカルはリモートより 1,957 コミット先行し、リモート固有コミットは 0 件だった。よって、最終候補はリモート clone ではなくローカル `main` の完全履歴から生成する。
- ユーザーは 2026-07-11 に Phase H の隔離ドライラン、バックアップ、ブラウザ検証を含む残作業を承認した。
- 本計画が要求する二回目の承認は、下記証拠を提示した後に別途取得する。事前の包括承認をこの確認の代用にはしない。

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
- H.2 開始時には、本書を含むその時点の最終 pre-rewrite `main` から新しい完全 bundle を作り、SHA-256 と `git bundle verify` を再記録する。初回 bundle は削除せず二重化する。

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

## H.2 最終記録（未実施）

- 二回目の承認: 未取得
- final pre-rewrite SHA / bundle: 未採取
- pushed rewritten SHA: 未実施
- authoritative fresh-clone stats: 未実施
- collaborator coordination/recovery status: 未実施
