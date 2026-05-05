# リポジトリ容量クリーンアップ委託手順書（Windows / PowerShell）

作成日: 2026-05-02  
対象: `C:\Users\quarr\Desktop\othello_v2`

## 1. 現状と原因（この端末での実測）

- 総容量が約 60GB になっている主因は `data/`（約 57.6GB）。
- `data/` の中でも `data/runs/` が約 52.2GB。
- `data/runs/browser_lv6_growth_v1/` が約 52.2GBで、内訳は主に `.ndjson`（約 26.1GB）と `.log`（約 25.8GB）。
- 次点は `.venv/`（約 4.6GB）。PyTorch/CUDA 依存が大きい。
- `data/` は `.gitignore` 済みなので、容量増加は主にローカル生成物。

## 2. 作業ゴール

- アプリ実行に必要な最小モデルを残しつつ、学習・検証の履歴ファイルを削除して容量を大きく戻す。
- まず `data/runs` を安全に掃除し、必要に応じて `.venv` と `data/egaroucid` を段階的に削除する。

## 3. 絶対ルール（委託先向け）

- 削除コマンドは必ず `dry-run` で確認してから `--apply` 実行。
- 学習ジョブ実行中は削除しない。先にジョブ停止を確認する。
- `git clean -fdx` は禁止。
- `data/models/policy-table.json`、`policy-net.onnx`、`policy-card.onnx`、`policy-target.onnx`、`policy-value.onnx` は保持。
- 作業ログ（実行コマンドと結果）をテキストで残す。

## 4. 実施手順

### Step A: 事前確認（必須）

```powershell
Set-Location C:\Users\quarr\Desktop\othello_v2
git rev-parse --show-toplevel
Get-Process python,node -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,Path
```

### Step B: 削除対象の事前確認（dry-run）

注意: `npm run selfplay:clean-artifacts` は現時点のラッパー不整合で失敗するため使わない。  
実体スクリプトを直接実行する。

```powershell
node .\dist\scripts\clean-selfplay-artifacts.js --keep-deployed
```

期待値:
- `targets=... size=...` が表示される。
- この環境では `size=52.17 GB` 相当が候補。

### Step C: バックアップ（任意だが推奨）

保持したい run がある場合だけ別ドライブへ退避する。

```powershell
New-Item -ItemType Directory -Force D:\othello_backup | Out-Null
robocopy .\data\runs\browser_lv6_growth_v1 D:\othello_backup\browser_lv6_growth_v1 /E /Z /R:1 /W:1 /MT:8
```

### Step D: 本削除（最重要）

```powershell
node .\dist\scripts\clean-selfplay-artifacts.js --keep-deployed --apply
```

期待値:
- `deleted=... failed=0`

### Step E: 追加クリーンアップ（必要時のみ）

1) Python仮想環境を再作成可能なら削除

```powershell
Remove-Item -LiteralPath .\.venv -Recurse -Force
```

2) Node依存を再インストール可能なら削除

```powershell
Remove-Item -LiteralPath .\node_modules -Recurse -Force
```

3) `data/egaroucid` を再生成・再取得可能なら削除（容量大）

```powershell
Remove-Item -LiteralPath .\data\egaroucid -Recurse -Force
```

## 5. 検証

```powershell
Get-ChildItem -Force | ForEach-Object {
  if ($_.PSIsContainer) {
    $size=(Get-ChildItem -LiteralPath $_.FullName -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  } else {
    $size=$_.Length
  }
  [PSCustomObject]@{Name=$_.Name; SizeGB=[math]::Round($size/1GB,3); SizeBytes=$size}
} | Sort-Object SizeBytes -Descending | Select-Object -First 15
```

最終確認:
- `data/runs` が大幅減少していること。
- `data/models` の本番用モデル5点が残っていること。
- 必要なら `npm ci` と `.venv` 再構築後に最低限の起動確認を実施すること。

## 6. 失敗時の対処

- `failed > 0` の場合は、失敗ファイルを個別に確認して再実行する。
- `Access denied` の場合は対象プロセス停止後に再実行する。
- 誤削除時は Step C のバックアップから戻す。

