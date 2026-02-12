param(
    [int]$Iterations = 999999,
    [double]$MaxHours = 24,
    [int]$Seed = 1001,
    [int]$SeedStride = 1000,
    [int]$TrainGames = 12000,
    [int]$EvalGames = 2000,
    [int]$SelfplayWorkers = 6,
    [int]$EvalWorkers = 3,
    [int]$SelfplaySeedStride = 1000003,
    [int]$MaxPlies = 220,
    [double]$CardUsageRate = 0.30,
    [int]$QuickGames = 500,
    [int]$FinalGames = 2000,
    [double]$Threshold = 0.05,
    [int]$CfrIterations = 12,
    [int]$MaxSamples = 600000,
    [int]$Epochs = 9999,
    [int]$BatchSize = 2048,
    [double]$Lr = 0.001,
    [int]$HiddenSize = 256,
    [double]$ValSplit = 0.1,
    [int]$EarlyStopPatience = 6,
    [double]$EarlyStopMinDelta = 0.0002,
    [string]$EarlyStopMonitor = "val_loss",
    [int]$MinVisits = 12,
    [double]$ShapeImmediate = 0.25,
    [string]$Device = "cuda",
    [int]$OnnxGateGames = 8,
    [int]$OnnxGateSeedCount = 3,
    [int]$OnnxGateSeedStride = 1000,
    [int]$OnnxGateSeedOffset = 800000,
    [double]$OnnxGateThreshold = 0.52,
    [double]$OnnxGateMinSeedScore = 0.45,
    [int]$OnnxGateMinSeedPassCount = 2,
    [int]$OnnxGateBlackLevel = 6,
    [int]$OnnxGateWhiteLevel = 5,
    [int]$OnnxGateTimeoutMs = 120000,
    [int]$OnnxGateMaxTotalMs = 900000,
    [int]$OnnxGateRetries = 2,
    [int]$MaxConsecutiveErrors = 5,
    [int]$ErrorBackoffSeconds = 10,
    [string]$RunTag = ""
)

$ErrorActionPreference = "Stop"

function Run-Strict([string]$Cmd, [string[]]$CmdArgs) {
    Write-Output "[deepcfr-cycle] run: $Cmd $($CmdArgs -join ' ')"
    & $Cmd @CmdArgs
    if ($LASTEXITCODE -ne 0) {
        throw "command failed(exit=$LASTEXITCODE): $Cmd"
    }
}

function Run-AllowDecision([string]$Cmd, [string[]]$CmdArgs) {
    Write-Output "[deepcfr-cycle] run: $Cmd $($CmdArgs -join ' ')"
    & $Cmd @CmdArgs
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 2) {
        throw "decision command failed(exit=$LASTEXITCODE): $Cmd"
    }
}

if ([string]::IsNullOrWhiteSpace($RunTag)) {
    $RunTag = "deepcfr_cycle_{0}" -f (Get-Date -Format "yyyyMMdd_HHmmss")
}

$startedAt = Get-Date
$deadline = $startedAt.AddHours($MaxHours)
$summary = [ordered]@{
    runTag = $RunTag
    startedAt = $startedAt.ToString("o")
    maxHours = $MaxHours
    iterationsRequested = $Iterations
    iterationsCompleted = 0
    totalErrors = 0
    maxConsecutiveErrors = $MaxConsecutiveErrors
    errorBackoffSeconds = $ErrorBackoffSeconds
    stoppedByTimeBudget = $false
    stopReason = $null
    entries = @()
}

if ($OnnxGateGames -lt 1) { throw "-OnnxGateGames must be >= 1" }
if ($OnnxGateSeedCount -lt 1) { throw "-OnnxGateSeedCount must be >= 1" }
if ($OnnxGateSeedStride -lt 1) { throw "-OnnxGateSeedStride must be >= 1" }
if ($OnnxGateSeedOffset -lt 1) { throw "-OnnxGateSeedOffset must be >= 1" }
if ($OnnxGateThreshold -lt 0 -or $OnnxGateThreshold -gt 1) { throw "-OnnxGateThreshold must be in [0,1]" }
if ($OnnxGateMinSeedScore -lt 0 -or $OnnxGateMinSeedScore -gt 1) { throw "-OnnxGateMinSeedScore must be in [0,1]" }
if ($OnnxGateMinSeedPassCount -lt 0 -or $OnnxGateMinSeedPassCount -gt $OnnxGateSeedCount) { throw "-OnnxGateMinSeedPassCount must be in [0,OnnxGateSeedCount]" }
if ($OnnxGateBlackLevel -lt 1 -or $OnnxGateBlackLevel -gt 6) { throw "-OnnxGateBlackLevel must be in [1,6]" }
if ($OnnxGateWhiteLevel -lt 1 -or $OnnxGateWhiteLevel -gt 6) { throw "-OnnxGateWhiteLevel must be in [1,6]" }
if ($OnnxGateTimeoutMs -lt 1000) { throw "-OnnxGateTimeoutMs must be >= 1000" }
if ($OnnxGateMaxTotalMs -lt 0) { throw "-OnnxGateMaxTotalMs must be >= 0" }
if ($OnnxGateRetries -lt 1) { throw "-OnnxGateRetries must be >= 1" }
if ($MaxConsecutiveErrors -lt 1) { throw "-MaxConsecutiveErrors must be >= 1" }
if ($ErrorBackoffSeconds -lt 0) { throw "-ErrorBackoffSeconds must be >= 0" }

Write-Output "[deepcfr-cycle] start runTag=$RunTag maxHours=$MaxHours deadline=$($deadline.ToString("o"))"

$consecutiveErrors = 0
for ($i = 1; $i -le $Iterations; $i++) {
    if ((Get-Date) -ge $deadline) {
        $summary.stoppedByTimeBudget = $true
        $summary.stopReason = "time budget reached before iteration $i"
        break
    }

    $iterTag = "{0}.it{1:D3}" -f $RunTag, $i
    $iterSeed = $Seed + (($i - 1) * $SeedStride)
    $entry = [ordered]@{
        iteration = $i
        tag = $iterTag
        seed = $iterSeed
        startedAt = (Get-Date).ToString("o")
        currentStep = "start"
        quickPassed = $false
        finalPassed = $false
        onnxGatePassed = $false
        onnxGateAttempts = 0
        promoted = $false
        error = $null
    }
    Write-Output "[deepcfr-cycle] iteration $i/$Iterations start tag=$iterTag seed=$iterSeed"

    $trainPath = "data/runs/selfplay.train.$iterTag.ndjson"
    $evalPath = "data/runs/selfplay.eval.$iterTag.ndjson"
    $candidateOnnx = "data/models/policy-net.candidate.$iterTag.onnx"
    $candidateMeta = "data/models/policy-net.candidate.$iterTag.onnx.meta.json"
    $candidateTable = "data/models/policy-table.candidate.$iterTag.json"
    $candidateCkpt = "data/models/policy-net.candidate.$iterTag.checkpoint.pt"
    $metricsOut = "data/runs/train.metrics.$iterTag.jsonl"
    $reportOut = "data/runs/train.report.$iterTag.json"
    $quickOut = "data/runs/adoption.quick.$iterTag.json"
    $finalOut = "data/runs/adoption.final.$iterTag.json"
    $onnxGateOut = "data/runs/adoption.onnx.$iterTag.json"

    try {
        $entry.currentStep = "generate-train"
        Run-Strict "node" @("scripts/generate-selfplay-data-parallel.js","--games","$TrainGames","--seed","$iterSeed","--seed-stride","$SelfplaySeedStride","--workers","$SelfplayWorkers","--max-plies","$MaxPlies","--out",$trainPath,"--with-cards","--card-usage-rate","$CardUsageRate")

        $entry.currentStep = "generate-eval"
        Run-Strict "node" @("scripts/generate-selfplay-data-parallel.js","--games","$EvalGames","--seed","$($iterSeed + 100000)","--seed-stride","$SelfplaySeedStride","--workers","$EvalWorkers","--max-plies","$MaxPlies","--out",$evalPath,"--with-cards","--card-usage-rate","$CardUsageRate")

        $entry.currentStep = "train-deepcfr"
        Run-Strict ".\.venv\Scripts\python.exe" @(".\ai\train\train_deepcfr_onnx.py","--input",$trainPath,"--onnx-out",$candidateOnnx,"--meta-out",$candidateMeta,"--policy-table-out",$candidateTable,"--report-out",$reportOut,"--metrics-out",$metricsOut,"--checkpoint-out",$candidateCkpt,"--cfr-iterations","$CfrIterations","--max-samples","$MaxSamples","--epochs","$Epochs","--batch-size","$BatchSize","--lr","$Lr","--hidden-size","$HiddenSize","--val-split","$ValSplit","--early-stop-patience","$EarlyStopPatience","--early-stop-min-delta","$EarlyStopMinDelta","--early-stop-monitor",$EarlyStopMonitor,"--min-visits","$MinVisits","--shape-immediate","$ShapeImmediate","--device",$Device)

        $entry.currentStep = "evaluate-policy-table"
        Run-Strict ".\.venv\Scripts\python.exe" @(".\ai\train\evaluate_policy_table.py","--input",$evalPath,"--model",$candidateTable)

        $entry.currentStep = "adoption-quick"
        Run-AllowDecision "node" @("scripts/benchmark-policy-adoption.js","--games","$QuickGames","--seed","$iterSeed","--seed-count","3","--seed-stride","1000","--max-plies","$MaxPlies","--threshold","$Threshold","--min-seed-uplift","-0.01","--min-seed-pass-count","2","--a-rate","$CardUsageRate","--b-rate","$CardUsageRate","--candidate-model",$candidateTable,"--out",$quickOut)
        $quick = Get-Content $quickOut -Raw | ConvertFrom-Json
        $entry.quickPassed = ($quick.decision.passed -eq $true)
        if (-not $entry.quickPassed) {
            $entry.finishedAt = (Get-Date).ToString("o")
            $summary.entries += $entry
            $summary.iterationsCompleted = $i
            $consecutiveErrors = 0
            Write-Output "[deepcfr-cycle] iteration $i quick failed"
            continue
        }

        $entry.currentStep = "adoption-final"
        Run-AllowDecision "node" @("scripts/benchmark-policy-adoption.js","--games","$FinalGames","--seed","$($iterSeed + 500000)","--seed-count","3","--seed-stride","1000","--max-plies","$MaxPlies","--threshold","$Threshold","--min-seed-uplift","-0.01","--min-seed-pass-count","2","--a-rate","$CardUsageRate","--b-rate","$CardUsageRate","--candidate-model",$candidateTable,"--out",$finalOut)
        $final = Get-Content $finalOut -Raw | ConvertFrom-Json
        $entry.finalPassed = ($final.decision.passed -eq $true)
        if (-not $entry.finalPassed) {
            $entry.finishedAt = (Get-Date).ToString("o")
            $summary.entries += $entry
            $summary.iterationsCompleted = $i
            $consecutiveErrors = 0
            Write-Output "[deepcfr-cycle] iteration $i final failed"
            continue
        }

        $entry.currentStep = "onnx-gate"
        $gatePassed = $false
        for ($gateAttempt = 1; $gateAttempt -le $OnnxGateRetries; $gateAttempt++) {
            $entry.onnxGateAttempts = $gateAttempt
            Run-AllowDecision "node" @("scripts/benchmark-policy-onnx-gate.js","--games","$OnnxGateGames","--seed","$($iterSeed + $OnnxGateSeedOffset)","--seed-count","$OnnxGateSeedCount","--seed-stride","$OnnxGateSeedStride","--threshold","$OnnxGateThreshold","--min-seed-score","$OnnxGateMinSeedScore","--min-seed-pass-count","$OnnxGateMinSeedPassCount","--timeout-ms","$OnnxGateTimeoutMs","--max-total-ms","$OnnxGateMaxTotalMs","--black-level","$OnnxGateBlackLevel","--white-level","$OnnxGateWhiteLevel","--candidate-onnx",$candidateOnnx,"--candidate-onnx-meta",$candidateMeta,"--out",$onnxGateOut)
            if (-not (Test-Path $onnxGateOut)) {
                if ($gateAttempt -lt $OnnxGateRetries) {
                    Write-Warning "[deepcfr-cycle] iteration $i onnx gate output missing; retry $($gateAttempt + 1)/$OnnxGateRetries"
                    Start-Sleep -Seconds 2
                    continue
                }
                break
            }
            $gate = Get-Content $onnxGateOut -Raw | ConvertFrom-Json
            $entry.onnxGatePassed = ($gate.decision.passed -eq $true)
            if ($entry.onnxGatePassed) {
                $gatePassed = $true
                break
            }
            if ($gateAttempt -lt $OnnxGateRetries) {
                Write-Output "[deepcfr-cycle] iteration $i onnx gate failed, retry $($gateAttempt + 1)/$OnnxGateRetries"
                Start-Sleep -Seconds 2
            }
        }
        if (-not $gatePassed) {
            $entry.finishedAt = (Get-Date).ToString("o")
            $summary.entries += $entry
            $summary.iterationsCompleted = $i
            $consecutiveErrors = 0
            Write-Output "[deepcfr-cycle] iteration $i onnx gate failed"
            continue
        }

        $entry.currentStep = "promote"
        Run-Strict "node" @("scripts/promote-policy-model.js","--adoption-result",$finalOut,"--candidate-model",$candidateTable,"--candidate-onnx",$candidateOnnx,"--candidate-onnx-meta",$candidateMeta)
        $entry.promoted = $true
        $entry.finishedAt = (Get-Date).ToString("o")
        $summary.entries += $entry
        $summary.iterationsCompleted = $i
        $consecutiveErrors = 0
        Write-Output "[deepcfr-cycle] iteration $i promoted"
    } catch {
        $entry.error = $_.Exception.Message
        $entry.finishedAt = (Get-Date).ToString("o")
        $summary.entries += $entry
        $summary.iterationsCompleted = $i
        $summary.totalErrors = [int]$summary.totalErrors + 1
        $consecutiveErrors += 1
        Write-Warning "[deepcfr-cycle] iteration $i error at step=$($entry.currentStep): $($entry.error)"

        if ((Get-Date) -ge $deadline) {
            $summary.stoppedByTimeBudget = $true
            $summary.stopReason = "time budget reached after iteration error $i"
            break
        }
        if ($consecutiveErrors -ge $MaxConsecutiveErrors) {
            $summary.stopReason = "stopped after $consecutiveErrors consecutive errors"
            break
        }
        if ($ErrorBackoffSeconds -gt 0) {
            Start-Sleep -Seconds $ErrorBackoffSeconds
        }
        continue
    }
}

if (-not $summary.stopReason) {
    $summary.stopReason = "completed requested iterations or loop exit"
}
$summary.finishedAt = (Get-Date).ToString("o")
$summary.elapsedMinutes = [math]::Round(((Get-Date) - $startedAt).TotalMinutes, 2)
$summaryOut = "data/runs/training-cycle.$RunTag.json"
$summary | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $summaryOut
Write-Output "[deepcfr-cycle] summary=$summaryOut"
