# カードリバーシ CNN学習監視スクリプト
$logFile = "C:\Users\quarr\Desktop\othello_v2\data\runs\browser_lv6_growth_v1\restart-cnn-v1-light.log"
$trainPattern = "selfplay\] (\d+)/(\d+) completed"
$iterationPattern = "iteration (\d+)/(\d+) start"
$trainFilePattern = "selfplay.train.*\.ndjson$"

function Get-TrainingProgress {
    param($LogPath)
    
    if (-not (Test-Path $LogPath)) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ログファイルが見つかりません: $LogPath" -ForegroundColor Red
        return
    }
    
    $content = Get-Content $LogPath -Tail 100
    $lastTrain = $content | Select-String $trainPattern | Select-Object -Last 1
    $lastIter = $content | Select-String $iterationPattern | Select-Object -Last 1
    
    if ($lastTrain) {
        $matches = $lastTrain.Matches[0].Groups
        $current = [int]$matches[1].Value
        $total = [int]$matches[2].Value
        $pct = [math]::Round(($current / $total) * 100, 1)
        $bar = "█" * [math]::Floor($pct / 5) + "░" * (20 - [math]::Floor($pct / 5))
        
        Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] セルフプレイ進捗" -ForegroundColor Cyan
        Write-Host "  進行: [$bar] $pct% ($current/$total games)" -ForegroundColor Green
        
        # 速度計算
        $firstTrain = $content | Select-String $trainPattern | Select-Object -First 1
        if ($firstTrain) {
            $firstMatch = $firstTrain.Matches[0].Groups
            $firstNum = [int]$firstMatch[1].Value
            $diff = $current - $firstNum
            if ($diff -gt 0) {
                Write-Host "  速度: 約 $diff games/100行" -ForegroundColor Yellow
            }
        }
    }
    
    if ($lastIter) {
        $matches = $lastIter.Matches[0].Groups
        Write-Host "  イテレーション: $($matches[1].Value)/$($matches[2].Value)" -ForegroundColor Magenta
    }
    
    # ファイルサイズ確認
    $trainFiles = Get-ChildItem "C:\Users\quarr\Desktop\othello_v2\data\runs\browser_lv6_growth_v1\" -Filter "*.ndjson" | Where-Object { $_.Name -match $trainFilePattern }
    if ($trainFiles) {
        $totalSize = ($trainFiles | Measure-Object -Property Length -Sum).Sum
        $sizeMB = [math]::Round($totalSize / 1MB, 2)
        Write-Host "  出力データ: $($trainFiles.Count) files, ${sizeMB}MB" -ForegroundColor Gray
    }
}

function Get-ProcessStatus {
    $process = Get-Process node | Where-Object { $_.CommandLine -like "*run-selfplay-training-cycle*" } | Select-Object -First 1
    if ($process) {
        $elapsed = (Get-Date) - $process.StartTime
        Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] プロセス状態" -ForegroundColor Cyan
        Write-Host "  PID: $($process.Id)" -ForegroundColor White
        Write-Host "  起動時間: $($elapsed.ToString('hh\:mm\:ss'))" -ForegroundColor White
        Write-Host "  CPU使用率: $([math]::Round($process.CPU, 1)) sec" -ForegroundColor White
        Write-Host "  メモリ: $([math]::Round($process.WorkingSet64 / 1MB, 1)) MB" -ForegroundColor White
    } else {
        Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] 学習プロセスが見つかりません" -ForegroundColor Red
    }
}

# メイン監視ループ
Write-Host "`n========================================" -ForegroundColor Blue
Write-Host "  カードリバーシ CNN学習監視ツール" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host "Ctrl+C で終了`n" -ForegroundColor DarkGray

while ($true) {
    Clear-Host
    Get-ProcessStatus
    Get-TrainingProgress -LogPath $logFile
    
    Write-Host "`n----------------------------------------" -ForegroundColor DarkGray
    Write-Host "次回更新: 10秒後..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 10
}
