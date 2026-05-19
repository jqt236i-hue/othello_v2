param(
    [int]$Iterations = 999999,
    [double]$MaxHours = 100,
    [int]$Seed = 1001,
    [int]$SeedStride = 1000,
    [int]$TrainGames = 22000,
    [int]$EvalGames = 3500,
    [int]$SelfplayWorkers = 0,
    [int]$EvalWorkers = 12,
    [int]$SelfplaySeedStride = 1000003,
    [int]$MaxPlies = 220,
    [double]$CardUsageRate = -1,
    [string]$CardUsageRates = "0.58,0.70,0.82,0.92",
    [double]$SelfplayPolicyMixRate = 0.85,
    [double]$SelfplayPolicyMixRateWarmup = 0.00,
    [string]$SelfplayPolicyMixRates = "0.82,0.88,0.76,0.92",
    [double]$SelfplayCardUsageRateJitter = 0.40,
    [double]$SelfplayTacticalWeightMin = 1.20,
    [double]$SelfplayTacticalWeightMax = 3.10,
    [string]$SelfplayTacticalWeightMinRates = "1.20,1.35,1.50,1.70",
    [string]$SelfplayTacticalWeightMaxRates = "3.10,3.30,3.50,3.80",
    [double]$SelfplayPolicyScoreWeightMin = 2.20,
    [double]$SelfplayPolicyScoreWeightMax = 4.00,
    [string]$SelfplayPolicyScoreWeightMinRates = "2.20,2.40,2.00,2.60",
    [string]$SelfplayPolicyScoreWeightMaxRates = "4.00,4.20,3.80,4.40",
    [double]$SelfplayHeuristicWeightMin = 0.75,
    [double]$SelfplayHeuristicWeightMax = 1.00,
    [string]$SelfplayHeuristicWeightMinRates = "0.75,0.78,0.72,0.80",
    [string]$SelfplayHeuristicWeightMaxRates = "1.00,1.00,0.96,1.00",
    [int]$SelfplayTacticalDepthOpening = 4,
    [int]$SelfplayTacticalDepthMid = 8,
    [int]$SelfplayTacticalDepthEnd = 12,
    [int]$SelfplayTacticalBeamWidth = 8,
    [string]$SelfplayTacticalDepthOpeningRates = "4,5,4,6",
    [string]$SelfplayTacticalDepthMidRates = "8,9,10,11",
    [string]$SelfplayTacticalDepthEndRates = "12,13,14,16",
    [string]$SelfplayTacticalBeamWidthRates = "8,10,12,14",
    [int]$NoPromotionEscalateAfter = 3,
    [double]$NoPromotionCardUsageBoost = 0.08,
    [double]$NoPromotionPolicyMixPenalty = 0.12,
    [int]$NoPromotionDepthBoost = 2,
    [int]$NoPromotionBeamBoost = 2,
    [int]$QuickGames = 700,
    [int]$FinalGames = 3000,
    [int]$AdoptionProgressEvery = 100,
    [int]$AdoptionSeedCount = 3,
    [int]$AdoptionSeedStride = 1000,
    [int]$AdoptionFinalSeedOffset = 500000,
    [double]$AdoptionMinSeedUplift = -0.01,
    [int]$AdoptionMinSeedPassCount = 2,
    [int]$AdoptionJobs = 0,
    [double]$AdoptionTacticalWeight = 0.25,
    [double]$AdoptionPolicyScoreWeight = 4.00,
    [double]$AdoptionHeuristicWeight = 0.85,
    [double]$AdoptionWhitePriority = 1.0,
    [double]$AdoptionQualityWeightCorner = 0.08,
    [double]$AdoptionQualityWeightBonus = 0.05,
    [double]$AdoptionQualityWeightCardImmediate = 0.06,
    [double]$AdoptionQualityWeightPlaceDelta = 0.05,
    [double]$Threshold = 0.05,
    [double]$AdoptionRelativeThreshold = 0.003,
    [bool]$AdoptionCompareWithPromoted = $true,
    [bool]$CoverageGateEnabled = $true,
    [double]$CoverageGateMin = 0.075,
    [double]$CoverageGateWarmupMin = 0.070,
    [int]$CoverageGateWarmupIterations = 12,
    [bool]$AdoptionPoolGateEnabled = $true,
    [int]$AdoptionPoolSize = 3,
    [int]$AdoptionPoolGames = 1500,
    [double]$AdoptionPoolThreshold = 0.008,
    [double]$AdoptionPoolMinSeedUplift = -0.01,
    [int]$AdoptionPoolMinSeedPassCount = 2,
    [int]$AdoptionPoolRequiredPassCount = 2,
    [int]$AdoptionPoolSeedOffset = 900000,
    [int]$CfrIterations = 40,
    [int]$MaxSamples = 1400000,
    [int]$Epochs = 9999,
    [int]$BatchSize = 1536,
    [double]$Lr = 0.00045,
    [int]$HiddenSize = 512,
    [double]$CardLossWeight = 2.0,
    [double]$CardNoActionWeight = 0.55,
    [double]$CardClassBalancePower = 0.40,
    [bool]$EnableCardSpecialist = $true,
    [int]$CardSpecialistEpochs = 300,
    [double]$CardSpecialistPlaceLossWeight = 0.15,
    [double]$CardSpecialistCardLossWeight = 4.2,
    [double]$CardSpecialistNoActionWeight = 0.25,
    [double]$CardSpecialistClassBalancePower = 0.70,
    [int]$CardSpecialistEarlyStopPatience = 16,
    [double]$CardSpecialistEarlyStopMinDelta = 0.00005,
    [int]$CardSpecialistEarlyStopMinEpochs = 32,
    [int]$CardSpecialistLrPlateauPatience = 6,
    [double]$CardSpecialistLrPlateauFactor = 0.65,
    [double]$CardSpecialistLrPlateauMinLr = 0.00002,
    [double]$ValSplit = 0.12,
    [int]$EarlyStopPatience = 24,
    [double]$EarlyStopMinDelta = 0.00003,
    [string]$EarlyStopMonitor = "val_place_loss",
    [string]$CardSpecialistEarlyStopMonitor = "val_card_loss",
    [int]$EarlyStopMinEpochs = 24,
    [int]$LrPlateauPatience = 8,
    [double]$LrPlateauFactor = 0.6,
    [double]$LrPlateauMinLr = 0.00003,
    [int]$MinVisits = 12,
    [double]$ShapeImmediate = 0.55,
    [string]$Device = "cuda",
    [int]$OnnxGateGames = 12,
    [int]$OnnxGateJobs = 4,
    [int]$OnnxGateSeedCount = 3,
    [int]$OnnxGateSeedStride = 1000,
    [int]$OnnxGateSeedOffset = 800000,
    [double]$OnnxGateThreshold = 0.52,
    [double]$OnnxGateMinSeedScore = 0.45,
    [int]$OnnxGateMinSeedPassCount = 2,
    [int]$OnnxGateBlackLevel = 6,
    [int]$OnnxGateWhiteLevel = 6,
    [string]$OnnxGateCandidateColorMode = "both",
    [int]$OnnxGateTimeoutMs = 150000,
    [int]$OnnxGateMaxTotalMs = 1200000,
    [int]$OnnxGateRetries = 3,
    [int]$OnnxGateMatchRetries = 1,
    [int]$UpliftStallWindow = 6,
    [double]$UpliftStallMinDelta = 0.002,
    [int]$UpliftStallMinIterations = 10,
    [int]$MaxConsecutiveErrors = 5,
    [int]$ErrorBackoffSeconds = 10,
    [string]$BootstrapPolicyModel = "data/models/policy-table.json",
    [string]$BootstrapCheckpoint = "",
    [bool]$AutoFindLatestCheckpoint = $true,
    [bool]$ResumeModelOnly = $true,
    [bool]$SelfplayUsePromotedModelOnly = $false,
    [string]$RunTag = "",
    [bool]$CleanupRepoPipResidue = $true,
    [int]$PipResidueMinAgeMinutes = 20,
    [bool]$AllowRepoPipInstallRunning = $false
)

$ErrorActionPreference = "Stop"
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
Set-Location $RepoRoot
Write-Output "[deepcfr-cycle] repoRoot=$RepoRoot"
if ([string]::IsNullOrWhiteSpace($env:PYTHONUNBUFFERED)) {
    $env:PYTHONUNBUFFERED = "1"
}
if ([string]::IsNullOrWhiteSpace($env:PYTHONIOENCODING)) {
    $env:PYTHONIOENCODING = "utf-8"
}
Write-Output "[deepcfr-cycle] python env: PYTHONUNBUFFERED=$($env:PYTHONUNBUFFERED) PYTHONIOENCODING=$($env:PYTHONIOENCODING)"

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

function Test-UpliftStall(
    [object[]]$Entries,
    [int]$Window,
    [double]$MinDelta,
    [int]$MinIterations
) {
    if ($Window -lt 2) { return @{ stop = $false; reason = $null; delta = $null; recentAvg = $null; prevAvg = $null } }
    if ($MinIterations -lt 0) { $MinIterations = 0 }

    $withFinal = @($Entries | Where-Object {
        $_ -and $_.PSObject.Properties['finalUplift'] -and [double]$_.finalUplift -ne $null
    })
    if ($withFinal.Count -lt ($Window * 2)) {
        return @{ stop = $false; reason = $null; delta = $null; recentAvg = $null; prevAvg = $null }
    }
    if ($withFinal.Count -lt $MinIterations) {
        return @{ stop = $false; reason = $null; delta = $null; recentAvg = $null; prevAvg = $null }
    }

    $recent = @($withFinal | Select-Object -Last $Window)
    $prev = @($withFinal | Select-Object -Last ($Window * 2) | Select-Object -First $Window)
    $recentAvg = [double](($recent | Measure-Object -Property finalUplift -Average).Average)
    $prevAvg = [double](($prev | Measure-Object -Property finalUplift -Average).Average)
    $delta = $recentAvg - $prevAvg

    if ($delta -lt $MinDelta) {
        $reason = "uplift stalled: recentAvg={0:N4}, prevAvg={1:N4}, delta={2:N4}, minDelta={3:N4}, window={4}" -f $recentAvg, $prevAvg, $delta, $MinDelta, $Window
        return @{ stop = $true; reason = $reason; delta = $delta; recentAvg = $recentAvg; prevAvg = $prevAvg }
    }
    return @{ stop = $false; reason = $null; delta = $delta; recentAvg = $recentAvg; prevAvg = $prevAvg }
}

function Resolve-RepoPath([string]$PathLike) {
    if ([string]::IsNullOrWhiteSpace($PathLike)) { return $null }
    if ([System.IO.Path]::IsPathRooted($PathLike)) {
        return [System.IO.Path]::GetFullPath($PathLike)
    }
    return [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $PathLike))
}

function Find-LatestCheckpoint([string]$SearchRoot) {
    if (-not (Test-Path $SearchRoot)) { return $null }
    $latest = Get-ChildItem -Path $SearchRoot -Filter "policy-net.candidate.*.checkpoint.pt" -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($latest) { return $latest.FullName }
    return $null
}

function Convert-CimCreationDate([string]$CreationDate) {
    if ([string]::IsNullOrWhiteSpace($CreationDate)) { return $null }
    try {
        return [System.Management.ManagementDateTimeConverter]::ToDateTime($CreationDate)
    } catch {
        return $null
    }
}

function Get-RepoPipInstallProcesses([string]$RepoRootPath) {
    $repoLower = [System.IO.Path]::GetFullPath($RepoRootPath).ToLowerInvariant()
    $venvLower = (Join-Path $repoLower ".venv").ToLowerInvariant()
    $hintWin = "ai\\train\\requirements.txt"
    $hintPosix = "ai/train/requirements.txt"

    $candidates = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match '^(python|pythonw)\.exe$' -and
        $_.CommandLine -and
        $_.CommandLine -match '(?i)-m\s+pip\s+install'
    }

    $result = @()
    foreach ($proc in $candidates) {
        $cmdLower = $proc.CommandLine.ToLowerInvariant()
        $isRepoRelated = $cmdLower.Contains($repoLower) -or $cmdLower.Contains($venvLower) -or $cmdLower.Contains($hintWin) -or $cmdLower.Contains($hintPosix)
        if (-not $isRepoRelated) { continue }

        $parentAlive = $false
        if ([int]$proc.ParentProcessId -gt 0) {
            $parent = Get-Process -Id ([int]$proc.ParentProcessId) -ErrorAction SilentlyContinue
            $parentAlive = ($null -ne $parent)
        }

        $result += [PSCustomObject]@{
            ProcessId = [int]$proc.ProcessId
            ParentProcessId = [int]$proc.ParentProcessId
            ParentAlive = $parentAlive
            StartTime = Convert-CimCreationDate $proc.CreationDate
            CommandLine = $proc.CommandLine
        }
    }

    return @($result)
}

function Remove-StaleRepoPipInstallProcesses([string]$RepoRootPath, [int]$MinAgeMinutes) {
    $found = @(Get-RepoPipInstallProcesses -RepoRootPath $RepoRootPath)
    $cutoff = (Get-Date).AddMinutes(-[Math]::Abs($MinAgeMinutes))

    $targets = @($found | Where-Object {
        (-not $_.ParentAlive) -or ($_.StartTime -and $_.StartTime -lt $cutoff)
    })

    $killed = @()
    foreach ($target in $targets) {
        try {
            Stop-Process -Id $target.ProcessId -Force -ErrorAction Stop
            $killed += $target
        } catch {
            Write-Warning "[deepcfr-cycle] failed to stop stale pip pid=$($target.ProcessId): $($_.Exception.Message)"
        }
    }

    if ($killed.Count -gt 0) {
        Start-Sleep -Seconds 1
    }

    $remaining = @(Get-RepoPipInstallProcesses -RepoRootPath $RepoRootPath)
    return @{
        found = $found
        killed = $killed
        remaining = $remaining
        cutoff = $cutoff
    }
}

function Acquire-RunLock([string]$LockPath, [string]$RunTagValue, [string]$RepoRootPath) {
    $lockDir = Split-Path -Parent $LockPath
    if (-not (Test-Path $lockDir)) {
        New-Item -ItemType Directory -Path $lockDir -Force | Out-Null
    }

    if (Test-Path $LockPath) {
        $existingRaw = Get-Content $LockPath -Raw -ErrorAction SilentlyContinue
        $existingPid = $null
        if (-not [string]::IsNullOrWhiteSpace($existingRaw)) {
            try {
                $existing = $existingRaw | ConvertFrom-Json
                if ($existing -and $existing.PSObject.Properties['pid'] -and $null -ne $existing.pid) {
                    $existingPid = [int]$existing.pid
                }
            } catch {
                $existingPid = $null
            }
        }

        if ($existingPid) {
            $existingProc = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
            if ($existingProc) {
                throw "[deepcfr-cycle] another run is active (pid=$existingPid). lock=$LockPath"
            }
        }

        Remove-Item $LockPath -Force -ErrorAction SilentlyContinue
        Write-Warning "[deepcfr-cycle] stale run lock removed: $LockPath"
    }

    $lockPayload = [ordered]@{
        runTag = $RunTagValue
        pid = $PID
        startedAt = (Get-Date).ToString("o")
        repoRoot = $RepoRootPath
    }
    $lockPayload | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 $LockPath
    Write-Output "[deepcfr-cycle] run lock acquired: $LockPath"
}

function Release-RunLock([string]$LockPath, [int]$OwnerPid) {
    if (-not (Test-Path $LockPath)) { return }

    $shouldRemove = $true
    $raw = Get-Content $LockPath -Raw -ErrorAction SilentlyContinue
    if (-not [string]::IsNullOrWhiteSpace($raw)) {
        try {
            $payload = $raw | ConvertFrom-Json
            if ($payload -and $payload.PSObject.Properties['pid'] -and $null -ne $payload.pid) {
                $lockPid = [int]$payload.pid
                if ($lockPid -ne $OwnerPid) {
                    $shouldRemove = $false
                }
            }
        } catch {
            $shouldRemove = $true
        }
    }

    if ($shouldRemove) {
        Remove-Item $LockPath -Force -ErrorAction SilentlyContinue
        Write-Output "[deepcfr-cycle] run lock released: $LockPath"
    } else {
        Write-Warning "[deepcfr-cycle] lock owner mismatch, keeping lock file: $LockPath"
    }
}

function Resolve-WorkerCount([int]$Requested, [double]$CpuRatio, [int]$MinValue, [int]$MaxValue) {
    if ($Requested -gt 0) {
        return [int]$Requested
    }
    $cpuCount = [Math]::Max(1, [Environment]::ProcessorCount)
    $resolved = [int][Math]::Floor($cpuCount * $CpuRatio)
    if ($resolved -lt $MinValue) { $resolved = $MinValue }
    if ($MaxValue -gt 0 -and $resolved -gt $MaxValue) { $resolved = $MaxValue }
    return [int][Math]::Max(1, $resolved)
}

function Resolve-AdoptionJobs([int]$Requested, [int]$CpuCount) {
    if ($Requested -gt 0) {
        return [int]$Requested
    }
    $base = [int][Math]::Floor([Math]::Max(1, $CpuCount) / 2)
    if ($base -lt 1) { $base = 1 }
    if ($base -gt 6) { $base = 6 }
    return $base
}

function Parse-CardUsageRates([string]$RatesText) {
    $out = @()
    if ([string]::IsNullOrWhiteSpace($RatesText)) {
        return $out
    }
    foreach ($raw in $RatesText.Split(',')) {
        $token = $raw.Trim()
        if ([string]::IsNullOrWhiteSpace($token)) { continue }
        $value = 0.0
        if (-not [double]::TryParse($token, [ref]$value)) { continue }
        if ($value -lt 0 -or $value -gt 1) { continue }
        $out += [double]$value
    }
    return $out
}

function Parse-DoubleSchedule([string]$RatesText, [double]$MinValue, [double]$MaxValue) {
    $out = @()
    if ([string]::IsNullOrWhiteSpace($RatesText)) {
        return $out
    }
    foreach ($raw in $RatesText.Split(',')) {
        $token = $raw.Trim()
        if ([string]::IsNullOrWhiteSpace($token)) { continue }
        $value = 0.0
        if (-not [double]::TryParse($token, [ref]$value)) { continue }
        if ($value -lt $MinValue -or $value -gt $MaxValue) { continue }
        $out += [double]$value
    }
    return $out
}

function Parse-IntSchedule([string]$RatesText, [int]$MinValue) {
    $out = @()
    if ([string]::IsNullOrWhiteSpace($RatesText)) {
        return $out
    }
    foreach ($raw in $RatesText.Split(',')) {
        $token = $raw.Trim()
        if ([string]::IsNullOrWhiteSpace($token)) { continue }
        $value = 0
        if (-not [int]::TryParse($token, [ref]$value)) { continue }
        if ($value -lt $MinValue) { continue }
        $out += [int]$value
    }
    return $out
}

function Resolve-IterationCardUsageRate([int]$Iteration, [double]$FixedRate, [double[]]$Schedule, [double]$Fallback) {
    if ($FixedRate -ge 0 -and $FixedRate -le 1) {
        return [double]$FixedRate
    }
    if ($Schedule -and $Schedule.Count -gt 0) {
        $index = ($Iteration - 1) % $Schedule.Count
        return [double]$Schedule[$index]
    }
    return [double]$Fallback
}

function Resolve-IterationScheduledDouble([int]$Iteration, [double]$Fallback, [double[]]$Schedule) {
    if ($Schedule -and $Schedule.Count -gt 0) {
        $index = ($Iteration - 1) % $Schedule.Count
        return [double]$Schedule[$index]
    }
    return [double]$Fallback
}

function Resolve-IterationScheduledInt([int]$Iteration, [int]$Fallback, [int[]]$Schedule) {
    if ($Schedule -and $Schedule.Count -gt 0) {
        $index = ($Iteration - 1) % $Schedule.Count
        return [int]$Schedule[$index]
    }
    return [int]$Fallback
}

function Resolve-CoverageGateMinForIteration([int]$Iteration, [double]$BaseMin, [double]$WarmupMin, [int]$WarmupIterations) {
    if ($WarmupIterations -gt 0 -and $Iteration -le $WarmupIterations) {
        return [double]$WarmupMin
    }
    return [double]$BaseMin
}

function Add-UniqueModelPath([System.Collections.Generic.List[string]]$ListRef, [string]$ModelPath) {
    if (-not $ListRef) { return }
    if ([string]::IsNullOrWhiteSpace($ModelPath)) { return }
    $resolved = Resolve-RepoPath $ModelPath
    if ([string]::IsNullOrWhiteSpace($resolved)) { return }
    if (-not (Test-Path $resolved)) { return }
    foreach ($existing in $ListRef) {
        if ([string]::Equals($existing, $resolved, [System.StringComparison]::OrdinalIgnoreCase)) {
            return
        }
    }
    $ListRef.Add($resolved) | Out-Null
}

function Get-AdoptionBaselinePool(
    [System.Collections.Generic.List[string]]$History,
    [string]$CurrentPromotedModel,
    [string]$CandidateModel,
    [int]$PoolSize
) {
    if ($PoolSize -lt 1) { return @() }
    $candidateResolved = Resolve-RepoPath $CandidateModel
    $pool = New-Object System.Collections.Generic.List[string]

    if (-not [string]::IsNullOrWhiteSpace($CurrentPromotedModel)) {
        Add-UniqueModelPath -ListRef $pool -ModelPath $CurrentPromotedModel
    }
    if ($History) {
        for ($idx = $History.Count - 1; $idx -ge 0; $idx--) {
            Add-UniqueModelPath -ListRef $pool -ModelPath $History[$idx]
            if ($pool.Count -ge $PoolSize) { break }
        }
    }
    $out = @()
    foreach ($one in $pool) {
        if ($candidateResolved -and [string]::Equals($one, $candidateResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
            continue
        }
        $out += $one
        if ($out.Count -ge $PoolSize) { break }
    }
    return @($out)
}

if ([string]::IsNullOrWhiteSpace($RunTag)) {
    $RunTag = "deepcfr_cycle_{0}" -f (Get-Date -Format "yyyyMMdd_HHmmss")
}

$lockPath = Resolve-RepoPath "data/runs/deepcfr-cycle.lock.json"
$lockAcquired = $false

try {
    Acquire-RunLock -LockPath $lockPath -RunTagValue $RunTag -RepoRootPath $RepoRoot
    $lockAcquired = $true

    if ($CleanupRepoPipResidue) {
        $cleanup = Remove-StaleRepoPipInstallProcesses -RepoRootPath $RepoRoot -MinAgeMinutes $PipResidueMinAgeMinutes
        if ($cleanup.killed.Count -gt 0) {
            Write-Output "[deepcfr-cycle] cleaned stale repo pip installs: $($cleanup.killed.Count) (age>=$PipResidueMinAgeMinutes min or orphan)"
        } else {
            Write-Output "[deepcfr-cycle] stale repo pip install cleanup: no targets"
        }
    } else {
        Write-Output "[deepcfr-cycle] stale repo pip install cleanup: skipped"
    }

    $activeRepoPip = @(Get-RepoPipInstallProcesses -RepoRootPath $RepoRoot)
    if ($activeRepoPip.Count -gt 0 -and -not $AllowRepoPipInstallRunning) {
        foreach ($row in ($activeRepoPip | Sort-Object ProcessId)) {
            $startLabel = if ($null -ne $row.StartTime) { $row.StartTime.ToString("s") } else { "unknown" }
            Write-Warning "[deepcfr-cycle] repo pip running pid=$($row.ProcessId) ppid=$($row.ParentProcessId) start=$startLabel parentAlive=$($row.ParentAlive)"
        }
        throw "[deepcfr-cycle] blocked: repo pip install is still running. wait for completion or rerun with -AllowRepoPipInstallRunning `$true."
    }

$startedAt = Get-Date
$deadline = $startedAt.AddHours($MaxHours)
$summary = [ordered]@{
    runTag = $RunTag
    startedAt = $startedAt.ToString("o")
    maxHours = $MaxHours
    iterationsRequested = $Iterations
    workerCpuCount = $null
    selfplayWorkers = $SelfplayWorkers
    evalWorkers = $EvalWorkers
    adoptionJobs = $AdoptionJobs
    adoptionWhitePriority = $AdoptionWhitePriority
    onnxGateMatchRetries = $OnnxGateMatchRetries
    onnxGateJobs = $OnnxGateJobs
    onnxGateCandidateColorMode = $OnnxGateCandidateColorMode
    adoptionSeedCount = $AdoptionSeedCount
    adoptionSeedStride = $AdoptionSeedStride
    adoptionFinalSeedOffset = $AdoptionFinalSeedOffset
    adoptionMinSeedUplift = $AdoptionMinSeedUplift
    adoptionMinSeedPassCount = $AdoptionMinSeedPassCount
    coverageGateEnabled = $CoverageGateEnabled
    coverageGateMin = $CoverageGateMin
    coverageGateWarmupMin = $CoverageGateWarmupMin
    coverageGateWarmupIterations = $CoverageGateWarmupIterations
    adoptionPoolGateEnabled = $AdoptionPoolGateEnabled
    adoptionPoolSize = $AdoptionPoolSize
    adoptionPoolGames = $AdoptionPoolGames
    adoptionPoolThreshold = $AdoptionPoolThreshold
    adoptionPoolMinSeedUplift = $AdoptionPoolMinSeedUplift
    adoptionPoolMinSeedPassCount = $AdoptionPoolMinSeedPassCount
    adoptionPoolRequiredPassCount = $AdoptionPoolRequiredPassCount
    adoptionPoolSeedOffset = $AdoptionPoolSeedOffset
    cardUsageRate = $CardUsageRate
    cardUsageRates = @()
    selfplayPolicyMixRate = $SelfplayPolicyMixRate
    selfplayPolicyMixRateWarmup = $SelfplayPolicyMixRateWarmup
    selfplayCardUsageRateJitter = $SelfplayCardUsageRateJitter
    selfplayTacticalWeightMin = $SelfplayTacticalWeightMin
    selfplayTacticalWeightMax = $SelfplayTacticalWeightMax
    selfplayPolicyScoreWeightMin = $SelfplayPolicyScoreWeightMin
    selfplayPolicyScoreWeightMax = $SelfplayPolicyScoreWeightMax
    selfplayHeuristicWeightMin = $SelfplayHeuristicWeightMin
    selfplayHeuristicWeightMax = $SelfplayHeuristicWeightMax
    selfplayTacticalDepthOpening = $SelfplayTacticalDepthOpening
    selfplayTacticalDepthMid = $SelfplayTacticalDepthMid
    selfplayTacticalDepthEnd = $SelfplayTacticalDepthEnd
    selfplayTacticalBeamWidth = $SelfplayTacticalBeamWidth
    adoptionPolicyScoreWeight = $AdoptionPolicyScoreWeight
    adoptionHeuristicWeight = $AdoptionHeuristicWeight
    adoptionProgressEvery = $AdoptionProgressEvery
    upliftStallWindow = $UpliftStallWindow
    upliftStallMinDelta = $UpliftStallMinDelta
    upliftStallMinIterations = $UpliftStallMinIterations
    iterationsCompleted = 0
    totalErrors = 0
    maxConsecutiveErrors = $MaxConsecutiveErrors
    errorBackoffSeconds = $ErrorBackoffSeconds
    bootstrapPolicyModel = $null
    bootstrapCheckpoint = $null
    autoFindLatestCheckpoint = $AutoFindLatestCheckpoint
    stoppedByTimeBudget = $false
    stopReason = $null
    entries = @()
}

if ($OnnxGateGames -lt 1) { throw "-OnnxGateGames must be >= 1" }
if ($OnnxGateJobs -lt 1) { throw "-OnnxGateJobs must be >= 1" }
if ($OnnxGateSeedCount -lt 1) { throw "-OnnxGateSeedCount must be >= 1" }
if ($OnnxGateSeedStride -lt 1) { throw "-OnnxGateSeedStride must be >= 1" }
if ($OnnxGateSeedOffset -lt 1) { throw "-OnnxGateSeedOffset must be >= 1" }
if ($OnnxGateThreshold -lt 0 -or $OnnxGateThreshold -gt 1) { throw "-OnnxGateThreshold must be in [0,1]" }
if ($OnnxGateMinSeedScore -lt 0 -or $OnnxGateMinSeedScore -gt 1) { throw "-OnnxGateMinSeedScore must be in [0,1]" }
if ($OnnxGateMinSeedPassCount -lt 0 -or $OnnxGateMinSeedPassCount -gt $OnnxGateSeedCount) { throw "-OnnxGateMinSeedPassCount must be in [0,OnnxGateSeedCount]" }
if ($OnnxGateBlackLevel -lt 1 -or $OnnxGateBlackLevel -gt 6) { throw "-OnnxGateBlackLevel must be in [1,6]" }
if ($OnnxGateWhiteLevel -lt 1 -or $OnnxGateWhiteLevel -gt 6) { throw "-OnnxGateWhiteLevel must be in [1,6]" }
if ($OnnxGateCandidateColorMode -ne "both" -and $OnnxGateCandidateColorMode -ne "white") { throw "-OnnxGateCandidateColorMode must be either 'both' or 'white'" }
if ($OnnxGateTimeoutMs -lt 1000) { throw "-OnnxGateTimeoutMs must be >= 1000" }
if ($OnnxGateMaxTotalMs -lt 0) { throw "-OnnxGateMaxTotalMs must be >= 0" }
if ($OnnxGateRetries -lt 1) { throw "-OnnxGateRetries must be >= 1" }
if ($OnnxGateMatchRetries -lt 0) { throw "-OnnxGateMatchRetries must be >= 0" }
if ($AdoptionProgressEvery -lt 0) { throw "-AdoptionProgressEvery must be >= 0" }
if ($AdoptionSeedCount -lt 1) { throw "-AdoptionSeedCount must be >= 1" }
if ($AdoptionSeedStride -lt 1) { throw "-AdoptionSeedStride must be >= 1" }
if ($AdoptionFinalSeedOffset -lt 0) { throw "-AdoptionFinalSeedOffset must be >= 0" }
if ($AdoptionMinSeedPassCount -lt 0 -or $AdoptionMinSeedPassCount -gt $AdoptionSeedCount) { throw "-AdoptionMinSeedPassCount must be in [0,AdoptionSeedCount]" }
if ($CoverageGateMin -lt 0 -or $CoverageGateMin -gt 1) { throw "-CoverageGateMin must be in [0,1]" }
if ($CoverageGateWarmupMin -lt 0 -or $CoverageGateWarmupMin -gt 1) { throw "-CoverageGateWarmupMin must be in [0,1]" }
if ($CoverageGateWarmupIterations -lt 0) { throw "-CoverageGateWarmupIterations must be >= 0" }
if ($CoverageGateWarmupMin -gt $CoverageGateMin) { throw "-CoverageGateWarmupMin must be <= CoverageGateMin" }
if ($AdoptionPoolSize -lt 0) { throw "-AdoptionPoolSize must be >= 0" }
if ($AdoptionPoolGames -lt 0) { throw "-AdoptionPoolGames must be >= 0" }
if ($AdoptionPoolThreshold -lt -1 -or $AdoptionPoolThreshold -gt 1) { throw "-AdoptionPoolThreshold must be in [-1,1]" }
if ($AdoptionPoolMinSeedUplift -lt -1 -or $AdoptionPoolMinSeedUplift -gt 1) { throw "-AdoptionPoolMinSeedUplift must be in [-1,1]" }
if ($AdoptionPoolMinSeedPassCount -lt 0 -or $AdoptionPoolMinSeedPassCount -gt $AdoptionSeedCount) { throw "-AdoptionPoolMinSeedPassCount must be in [0,AdoptionSeedCount]" }
if ($AdoptionPoolRequiredPassCount -lt 0) { throw "-AdoptionPoolRequiredPassCount must be >= 0" }
if ($AdoptionPoolSeedOffset -lt 0) { throw "-AdoptionPoolSeedOffset must be >= 0" }
if ($AdoptionJobs -lt 0) { throw "-AdoptionJobs must be >= 0" }
if ($AdoptionWhitePriority -lt 0 -or $AdoptionWhitePriority -gt 1) { throw "-AdoptionWhitePriority must be in [0,1]" }
if ($AdoptionQualityWeightCorner -lt 0 -or $AdoptionQualityWeightCorner -gt 1) { throw "-AdoptionQualityWeightCorner must be in [0,1]" }
if ($AdoptionQualityWeightBonus -lt 0 -or $AdoptionQualityWeightBonus -gt 1) { throw "-AdoptionQualityWeightBonus must be in [0,1]" }
if ($AdoptionQualityWeightCardImmediate -lt 0 -or $AdoptionQualityWeightCardImmediate -gt 1) { throw "-AdoptionQualityWeightCardImmediate must be in [0,1]" }
if ($AdoptionQualityWeightPlaceDelta -lt 0 -or $AdoptionQualityWeightPlaceDelta -gt 1) { throw "-AdoptionQualityWeightPlaceDelta must be in [0,1]" }
if ($AdoptionRelativeThreshold -lt 0 -or $AdoptionRelativeThreshold -gt 1) { throw "-AdoptionRelativeThreshold must be in [0,1]" }
if ($UpliftStallWindow -lt 0) { throw "-UpliftStallWindow must be >= 0" }
if ($UpliftStallMinDelta -lt 0) { throw "-UpliftStallMinDelta must be >= 0" }
if ($UpliftStallMinIterations -lt 0) { throw "-UpliftStallMinIterations must be >= 0" }
if ($MaxConsecutiveErrors -lt 1) { throw "-MaxConsecutiveErrors must be >= 1" }
if ($ErrorBackoffSeconds -lt 0) { throw "-ErrorBackoffSeconds must be >= 0" }
if ($PipResidueMinAgeMinutes -lt 0) { throw "-PipResidueMinAgeMinutes must be >= 0" }
if ($EarlyStopMinEpochs -lt 0) { throw "-EarlyStopMinEpochs must be >= 0" }
if ($LrPlateauPatience -lt 0) { throw "-LrPlateauPatience must be >= 0" }
if ($LrPlateauPatience -gt 0) {
    if ($LrPlateauFactor -le 0 -or $LrPlateauFactor -ge 1) { throw "-LrPlateauFactor must be in (0,1) when LrPlateauPatience > 0" }
    if ($LrPlateauMinLr -le 0) { throw "-LrPlateauMinLr must be > 0 when LrPlateauPatience > 0" }
}
if ($SelfplayPolicyMixRate -lt 0 -or $SelfplayPolicyMixRate -gt 1) { throw "-SelfplayPolicyMixRate must be in [0,1]" }
if ($SelfplayPolicyMixRateWarmup -lt 0 -or $SelfplayPolicyMixRateWarmup -gt 1) { throw "-SelfplayPolicyMixRateWarmup must be in [0,1]" }
if ($SelfplayCardUsageRateJitter -lt 0 -or $SelfplayCardUsageRateJitter -gt 1) { throw "-SelfplayCardUsageRateJitter must be in [0,1]" }
if ($SelfplayTacticalWeightMin -lt 0) { throw "-SelfplayTacticalWeightMin must be >= 0" }
if ($SelfplayTacticalWeightMax -lt 0) { throw "-SelfplayTacticalWeightMax must be >= 0" }
if ($SelfplayTacticalWeightMax -lt $SelfplayTacticalWeightMin) { throw "-SelfplayTacticalWeightMax must be >= SelfplayTacticalWeightMin" }
if ($SelfplayPolicyScoreWeightMin -lt 0) { throw "-SelfplayPolicyScoreWeightMin must be >= 0" }
if ($SelfplayPolicyScoreWeightMax -lt 0) { throw "-SelfplayPolicyScoreWeightMax must be >= 0" }
if ($SelfplayPolicyScoreWeightMax -lt $SelfplayPolicyScoreWeightMin) { throw "-SelfplayPolicyScoreWeightMax must be >= SelfplayPolicyScoreWeightMin" }
if ($SelfplayHeuristicWeightMin -lt 0) { throw "-SelfplayHeuristicWeightMin must be >= 0" }
if ($SelfplayHeuristicWeightMax -lt 0) { throw "-SelfplayHeuristicWeightMax must be >= 0" }
if ($SelfplayHeuristicWeightMax -lt $SelfplayHeuristicWeightMin) { throw "-SelfplayHeuristicWeightMax must be >= SelfplayHeuristicWeightMin" }
if ($SelfplayTacticalDepthOpening -lt 0) { throw "-SelfplayTacticalDepthOpening must be >= 0" }
if ($SelfplayTacticalDepthMid -lt 0) { throw "-SelfplayTacticalDepthMid must be >= 0" }
if ($SelfplayTacticalDepthEnd -lt 0) { throw "-SelfplayTacticalDepthEnd must be >= 0" }
if ($SelfplayTacticalBeamWidth -lt 0) { throw "-SelfplayTacticalBeamWidth must be >= 0" }
if ($AdoptionTacticalWeight -lt 0) { throw "-AdoptionTacticalWeight must be >= 0" }
if ($AdoptionPolicyScoreWeight -lt 0) { throw "-AdoptionPolicyScoreWeight must be >= 0" }
if ($AdoptionHeuristicWeight -lt 0) { throw "-AdoptionHeuristicWeight must be >= 0" }
if ($NoPromotionEscalateAfter -lt 0) { throw "-NoPromotionEscalateAfter must be >= 0" }
if ($NoPromotionCardUsageBoost -lt 0 -or $NoPromotionCardUsageBoost -gt 1) { throw "-NoPromotionCardUsageBoost must be in [0,1]" }
if ($NoPromotionPolicyMixPenalty -lt 0 -or $NoPromotionPolicyMixPenalty -gt 1) { throw "-NoPromotionPolicyMixPenalty must be in [0,1]" }
if ($NoPromotionDepthBoost -lt 0) { throw "-NoPromotionDepthBoost must be >= 0" }
if ($NoPromotionBeamBoost -lt 0) { throw "-NoPromotionBeamBoost must be >= 0" }
if ($CardLossWeight -le 0) { throw "-CardLossWeight must be > 0" }
if ($CardSpecialistEpochs -lt 1) { throw "-CardSpecialistEpochs must be >= 1" }
if ($CardSpecialistPlaceLossWeight -le 0) { throw "-CardSpecialistPlaceLossWeight must be > 0" }
if ($CardSpecialistCardLossWeight -le 0) { throw "-CardSpecialistCardLossWeight must be > 0" }
if ($CardSpecialistEarlyStopPatience -lt 0) { throw "-CardSpecialistEarlyStopPatience must be >= 0" }
if ($CardSpecialistEarlyStopMinDelta -lt 0) { throw "-CardSpecialistEarlyStopMinDelta must be >= 0" }
if ($CardSpecialistEarlyStopMinEpochs -lt 0) { throw "-CardSpecialistEarlyStopMinEpochs must be >= 0" }
if ($CardSpecialistLrPlateauPatience -lt 0) { throw "-CardSpecialistLrPlateauPatience must be >= 0" }
if ($CardSpecialistLrPlateauPatience -gt 0) {
    if ($CardSpecialistLrPlateauFactor -le 0 -or $CardSpecialistLrPlateauFactor -ge 1) { throw "-CardSpecialistLrPlateauFactor must be in (0,1) when CardSpecialistLrPlateauPatience > 0" }
    if ($CardSpecialistLrPlateauMinLr -le 0) { throw "-CardSpecialistLrPlateauMinLr must be > 0 when CardSpecialistLrPlateauPatience > 0" }
}

$cardUsageSchedule = [double[]](Parse-CardUsageRates $CardUsageRates)
$policyMixRateSchedule = [double[]](Parse-DoubleSchedule -RatesText $SelfplayPolicyMixRates -MinValue 0 -MaxValue 1)
$tacticalWeightMinSchedule = [double[]](Parse-DoubleSchedule -RatesText $SelfplayTacticalWeightMinRates -MinValue 0 -MaxValue 100)
$tacticalWeightMaxSchedule = [double[]](Parse-DoubleSchedule -RatesText $SelfplayTacticalWeightMaxRates -MinValue 0 -MaxValue 100)
$policyScoreWeightMinSchedule = [double[]](Parse-DoubleSchedule -RatesText $SelfplayPolicyScoreWeightMinRates -MinValue 0 -MaxValue 100)
$policyScoreWeightMaxSchedule = [double[]](Parse-DoubleSchedule -RatesText $SelfplayPolicyScoreWeightMaxRates -MinValue 0 -MaxValue 100)
$heuristicWeightMinSchedule = [double[]](Parse-DoubleSchedule -RatesText $SelfplayHeuristicWeightMinRates -MinValue 0 -MaxValue 100)
$heuristicWeightMaxSchedule = [double[]](Parse-DoubleSchedule -RatesText $SelfplayHeuristicWeightMaxRates -MinValue 0 -MaxValue 100)
$tacticalDepthOpeningSchedule = [int[]](Parse-IntSchedule -RatesText $SelfplayTacticalDepthOpeningRates -MinValue 0)
$tacticalDepthMidSchedule = [int[]](Parse-IntSchedule -RatesText $SelfplayTacticalDepthMidRates -MinValue 0)
$tacticalDepthEndSchedule = [int[]](Parse-IntSchedule -RatesText $SelfplayTacticalDepthEndRates -MinValue 0)
$tacticalBeamWidthSchedule = [int[]](Parse-IntSchedule -RatesText $SelfplayTacticalBeamWidthRates -MinValue 0)

$isFixedCardUsageRate = ($CardUsageRate -ge 0 -and $CardUsageRate -le 1)
if (-not $isFixedCardUsageRate) {
    if ($CardUsageRate -ne -1) {
        throw "-CardUsageRate must be in [0,1] or -1(schedule mode)"
    }
    if (-not $cardUsageSchedule -or $cardUsageSchedule.Count -lt 1) {
        throw "-CardUsageRates must include at least one value in [0,1] when -CardUsageRate is -1"
    }
}
if ($policyMixRateSchedule.Count -gt 0) {
    foreach ($v in $policyMixRateSchedule) {
        if ($v -lt 0 -or $v -gt 1) { throw "-SelfplayPolicyMixRates must contain values in [0,1]" }
    }
}
if ($tacticalWeightMinSchedule.Count -gt 0 -and $tacticalWeightMaxSchedule.Count -gt 0 -and $tacticalWeightMinSchedule.Count -ne $tacticalWeightMaxSchedule.Count) {
    throw "-SelfplayTacticalWeightMinRates and -SelfplayTacticalWeightMaxRates must have the same number of values"
}
if ($policyScoreWeightMinSchedule.Count -gt 0 -and $policyScoreWeightMaxSchedule.Count -gt 0 -and $policyScoreWeightMinSchedule.Count -ne $policyScoreWeightMaxSchedule.Count) {
    throw "-SelfplayPolicyScoreWeightMinRates and -SelfplayPolicyScoreWeightMaxRates must have the same number of values"
}
if ($heuristicWeightMinSchedule.Count -gt 0 -and $heuristicWeightMaxSchedule.Count -gt 0 -and $heuristicWeightMinSchedule.Count -ne $heuristicWeightMaxSchedule.Count) {
    throw "-SelfplayHeuristicWeightMinRates and -SelfplayHeuristicWeightMaxRates must have the same number of values"
}
if ($tacticalDepthOpeningSchedule.Count -gt 0 -and $tacticalDepthMidSchedule.Count -gt 0 -and $tacticalDepthOpeningSchedule.Count -ne $tacticalDepthMidSchedule.Count) {
    throw "-SelfplayTacticalDepthOpeningRates and -SelfplayTacticalDepthMidRates must have the same number of values"
}
if ($tacticalDepthOpeningSchedule.Count -gt 0 -and $tacticalDepthEndSchedule.Count -gt 0 -and $tacticalDepthOpeningSchedule.Count -ne $tacticalDepthEndSchedule.Count) {
    throw "-SelfplayTacticalDepthOpeningRates and -SelfplayTacticalDepthEndRates must have the same number of values"
}
if ($tacticalDepthOpeningSchedule.Count -gt 0 -and $tacticalBeamWidthSchedule.Count -gt 0 -and $tacticalDepthOpeningSchedule.Count -ne $tacticalBeamWidthSchedule.Count) {
    throw "-SelfplayTacticalDepthOpeningRates and -SelfplayTacticalBeamWidthRates must have the same number of values"
}

$cpuCount = [Math]::Max(1, [Environment]::ProcessorCount)
$SelfplayWorkers = Resolve-WorkerCount -Requested $SelfplayWorkers -CpuRatio 0.65 -MinValue 2 -MaxValue 32
$EvalWorkers = Resolve-WorkerCount -Requested $EvalWorkers -CpuRatio 0.35 -MinValue 1 -MaxValue 16
$AdoptionJobs = Resolve-AdoptionJobs -Requested $AdoptionJobs -CpuCount $cpuCount

Write-Output "[deepcfr-cycle] worker config: cpu=$cpuCount selfplay=$SelfplayWorkers eval=$EvalWorkers adoptionJobs=$AdoptionJobs"
if ($isFixedCardUsageRate) {
    Write-Output "[deepcfr-cycle] card usage mode: fixed rate=$CardUsageRate"
} else {
    Write-Output "[deepcfr-cycle] card usage mode: schedule rates=$($cardUsageSchedule -join ',')"
}
if ($policyMixRateSchedule.Count -gt 0) {
    Write-Output "[deepcfr-cycle] policy mix schedule: $($policyMixRateSchedule -join ',')"
}
if ($tacticalDepthOpeningSchedule.Count -gt 0) {
    Write-Output "[deepcfr-cycle] tactical depth schedule (open/mid/end/beam): $($tacticalDepthOpeningSchedule -join ',') / $($tacticalDepthMidSchedule -join ',') / $($tacticalDepthEndSchedule -join ',') / $($tacticalBeamWidthSchedule -join ',')"
}
Write-Output "[deepcfr-cycle] selfplay diversity: policyMixRateBase=$SelfplayPolicyMixRate warmupPolicyMixRate=$SelfplayPolicyMixRateWarmup cardUsageJitter=$SelfplayCardUsageRateJitter tacticalWeightRange=$SelfplayTacticalWeightMin..$SelfplayTacticalWeightMax policyWeightRange=$SelfplayPolicyScoreWeightMin..$SelfplayPolicyScoreWeightMax heuristicWeightRange=$SelfplayHeuristicWeightMin..$SelfplayHeuristicWeightMax tacticalDepth=$SelfplayTacticalDepthOpening/$SelfplayTacticalDepthMid/$SelfplayTacticalDepthEnd beamWidth=$SelfplayTacticalBeamWidth"
Write-Output "[deepcfr-cycle] no-promotion escalation: after=$NoPromotionEscalateAfter cardUsageBoost=$NoPromotionCardUsageBoost policyMixPenalty=$NoPromotionPolicyMixPenalty depthBoost=$NoPromotionDepthBoost beamBoost=$NoPromotionBeamBoost"
Write-Output "[deepcfr-cycle] adoption weights: tacticalWeight=$AdoptionTacticalWeight policyScoreWeight=$AdoptionPolicyScoreWeight heuristicWeight=$AdoptionHeuristicWeight"
Write-Output "[deepcfr-cycle] deepcfr train: cfrIterations=$CfrIterations maxSamples=$MaxSamples batchSize=$BatchSize lr=$Lr shapeImmediate=$ShapeImmediate monitor=$EarlyStopMonitor cardLossWeight=$CardLossWeight cardNoActionWeight=$CardNoActionWeight cardClassBalancePower=$CardClassBalancePower"
Write-Output "[deepcfr-cycle] card specialist: enabled=$EnableCardSpecialist epochs=$CardSpecialistEpochs placeLossWeight=$CardSpecialistPlaceLossWeight cardLossWeight=$CardSpecialistCardLossWeight monitor=$CardSpecialistEarlyStopMonitor noActionWeight=$CardSpecialistNoActionWeight classBalancePower=$CardSpecialistClassBalancePower"
Write-Output "[deepcfr-cycle] coverage gate: enabled=$CoverageGateEnabled min=$CoverageGateMin warmupMin=$CoverageGateWarmupMin warmupIterations=$CoverageGateWarmupIterations"
Write-Output "[deepcfr-cycle] adoption pool gate: enabled=$AdoptionPoolGateEnabled size=$AdoptionPoolSize games=$AdoptionPoolGames threshold=$AdoptionPoolThreshold minSeedUplift=$AdoptionPoolMinSeedUplift minSeedPassCount=$AdoptionPoolMinSeedPassCount requiredPassCount=$AdoptionPoolRequiredPassCount"
if ($SelfplayUsePromotedModelOnly) {
    Write-Output "[deepcfr-cycle] selfplay teacher update mode: promoted-only"
} else {
    Write-Output "[deepcfr-cycle] selfplay teacher update mode: candidate-every-iteration"
}

$summary.workerCpuCount = $cpuCount
$summary.selfplayWorkers = $SelfplayWorkers
$summary.evalWorkers = $EvalWorkers
$summary.adoptionJobs = $AdoptionJobs
$summary.adoptionWhitePriority = $AdoptionWhitePriority
$summary.adoptionQualityWeightCorner = $AdoptionQualityWeightCorner
$summary.adoptionQualityWeightBonus = $AdoptionQualityWeightBonus
$summary.adoptionQualityWeightCardImmediate = $AdoptionQualityWeightCardImmediate
$summary.adoptionQualityWeightPlaceDelta = $AdoptionQualityWeightPlaceDelta
$summary.cfrIterations = $CfrIterations
$summary.maxSamples = $MaxSamples
$summary.batchSize = $BatchSize
$summary.learningRate = $Lr
$summary.shapeImmediate = $ShapeImmediate
$summary.earlyStopMonitor = $EarlyStopMonitor
$summary.cardLossWeight = $CardLossWeight
$summary.cardNoActionWeight = $CardNoActionWeight
$summary.cardClassBalancePower = $CardClassBalancePower
$summary.cardSpecialistEarlyStopMonitor = $CardSpecialistEarlyStopMonitor
$summary.cardSpecialistNoActionWeight = $CardSpecialistNoActionWeight
$summary.cardSpecialistClassBalancePower = $CardSpecialistClassBalancePower
$summary.onnxGateMatchRetries = $OnnxGateMatchRetries
$summary.onnxGateJobs = $OnnxGateJobs
$summary.onnxGateCandidateColorMode = $OnnxGateCandidateColorMode
$summary.adoptionSeedCount = $AdoptionSeedCount
$summary.adoptionSeedStride = $AdoptionSeedStride
$summary.adoptionFinalSeedOffset = $AdoptionFinalSeedOffset
$summary.adoptionMinSeedUplift = $AdoptionMinSeedUplift
$summary.adoptionMinSeedPassCount = $AdoptionMinSeedPassCount
$summary.adoptionTacticalWeight = $AdoptionTacticalWeight
$summary.coverageGateEnabled = $CoverageGateEnabled
$summary.coverageGateMin = $CoverageGateMin
$summary.coverageGateWarmupMin = $CoverageGateWarmupMin
$summary.coverageGateWarmupIterations = $CoverageGateWarmupIterations
$summary.adoptionPoolGateEnabled = $AdoptionPoolGateEnabled
$summary.adoptionPoolSize = $AdoptionPoolSize
$summary.adoptionPoolGames = $AdoptionPoolGames
$summary.adoptionPoolThreshold = $AdoptionPoolThreshold
$summary.adoptionPoolMinSeedUplift = $AdoptionPoolMinSeedUplift
$summary.adoptionPoolMinSeedPassCount = $AdoptionPoolMinSeedPassCount
$summary.adoptionPoolRequiredPassCount = $AdoptionPoolRequiredPassCount
$summary.adoptionPoolSeedOffset = $AdoptionPoolSeedOffset
$summary.adoptionRelativeThreshold = $AdoptionRelativeThreshold
$summary.adoptionCompareWithPromoted = $AdoptionCompareWithPromoted
$summary.cardUsageRate = $CardUsageRate
$summary.cardUsageRates = @($cardUsageSchedule)
$summary.selfplayPolicyMixRate = $SelfplayPolicyMixRate
$summary.selfplayPolicyMixRateWarmup = $SelfplayPolicyMixRateWarmup
$summary.selfplayPolicyMixRates = @($policyMixRateSchedule)
$summary.selfplayCardUsageRateJitter = $SelfplayCardUsageRateJitter
$summary.selfplayTacticalWeightMin = $SelfplayTacticalWeightMin
$summary.selfplayTacticalWeightMax = $SelfplayTacticalWeightMax
$summary.selfplayTacticalWeightMinRates = @($tacticalWeightMinSchedule)
$summary.selfplayTacticalWeightMaxRates = @($tacticalWeightMaxSchedule)
$summary.selfplayPolicyScoreWeightMin = $SelfplayPolicyScoreWeightMin
$summary.selfplayPolicyScoreWeightMax = $SelfplayPolicyScoreWeightMax
$summary.selfplayPolicyScoreWeightMinRates = @($policyScoreWeightMinSchedule)
$summary.selfplayPolicyScoreWeightMaxRates = @($policyScoreWeightMaxSchedule)
$summary.selfplayHeuristicWeightMin = $SelfplayHeuristicWeightMin
$summary.selfplayHeuristicWeightMax = $SelfplayHeuristicWeightMax
$summary.selfplayHeuristicWeightMinRates = @($heuristicWeightMinSchedule)
$summary.selfplayHeuristicWeightMaxRates = @($heuristicWeightMaxSchedule)
$summary.selfplayTacticalDepthOpening = $SelfplayTacticalDepthOpening
$summary.selfplayTacticalDepthMid = $SelfplayTacticalDepthMid
$summary.selfplayTacticalDepthEnd = $SelfplayTacticalDepthEnd
$summary.selfplayTacticalBeamWidth = $SelfplayTacticalBeamWidth
$summary.selfplayTacticalDepthOpeningRates = @($tacticalDepthOpeningSchedule)
$summary.selfplayTacticalDepthMidRates = @($tacticalDepthMidSchedule)
$summary.selfplayTacticalDepthEndRates = @($tacticalDepthEndSchedule)
$summary.selfplayTacticalBeamWidthRates = @($tacticalBeamWidthSchedule)
$summary.noPromotionEscalateAfter = $NoPromotionEscalateAfter
$summary.noPromotionCardUsageBoost = $NoPromotionCardUsageBoost
$summary.noPromotionPolicyMixPenalty = $NoPromotionPolicyMixPenalty
$summary.noPromotionDepthBoost = $NoPromotionDepthBoost
$summary.noPromotionBeamBoost = $NoPromotionBeamBoost
$summary.adoptionPolicyScoreWeight = $AdoptionPolicyScoreWeight
$summary.adoptionHeuristicWeight = $AdoptionHeuristicWeight
$summary.cardLossWeight = $CardLossWeight
$summary.enableCardSpecialist = $EnableCardSpecialist
$summary.cardSpecialistEpochs = $CardSpecialistEpochs
$summary.cardSpecialistPlaceLossWeight = $CardSpecialistPlaceLossWeight
$summary.cardSpecialistCardLossWeight = $CardSpecialistCardLossWeight
$summary.cardSpecialistEarlyStopPatience = $CardSpecialistEarlyStopPatience
$summary.cardSpecialistEarlyStopMinDelta = $CardSpecialistEarlyStopMinDelta
$summary.cardSpecialistEarlyStopMinEpochs = $CardSpecialistEarlyStopMinEpochs
$summary.cardSpecialistLrPlateauPatience = $CardSpecialistLrPlateauPatience
$summary.cardSpecialistLrPlateauFactor = $CardSpecialistLrPlateauFactor
$summary.cardSpecialistLrPlateauMinLr = $CardSpecialistLrPlateauMinLr
$summary.earlyStopMinEpochs = $EarlyStopMinEpochs
$summary.lrPlateauPatience = $LrPlateauPatience
$summary.lrPlateauFactor = $LrPlateauFactor
$summary.lrPlateauMinLr = $LrPlateauMinLr
$summary.resumeModelOnly = $ResumeModelOnly
$summary.selfplayUsePromotedModelOnly = $SelfplayUsePromotedModelOnly

$resolvedBootstrapPolicyModel = Resolve-RepoPath $BootstrapPolicyModel
$resolvedBootstrapCheckpoint = Resolve-RepoPath $BootstrapCheckpoint
if ($resolvedBootstrapPolicyModel -and -not (Test-Path $resolvedBootstrapPolicyModel)) {
    Write-Warning "[deepcfr-cycle] bootstrap policy model not found, ignored: $resolvedBootstrapPolicyModel"
    $resolvedBootstrapPolicyModel = $null
}
if ($resolvedBootstrapCheckpoint -and -not (Test-Path $resolvedBootstrapCheckpoint)) {
    throw "-BootstrapCheckpoint not found: $resolvedBootstrapCheckpoint"
}
if (-not $resolvedBootstrapCheckpoint -and $AutoFindLatestCheckpoint) {
    $resolvedBootstrapCheckpoint = Find-LatestCheckpoint (Resolve-RepoPath "data/models")
}

$currentSelfplayPolicyModel = $resolvedBootstrapPolicyModel
$promotedPolicyModelPath = Resolve-RepoPath "data/models/policy-table.json"
$currentPromotedPolicyModel = $null
if ($promotedPolicyModelPath -and (Test-Path $promotedPolicyModelPath)) {
    $currentPromotedPolicyModel = $promotedPolicyModelPath
} elseif ($resolvedBootstrapPolicyModel) {
    # Fallback for first run when promoted file is not present yet.
    $currentPromotedPolicyModel = $resolvedBootstrapPolicyModel
}
$currentResumeCheckpoint = $resolvedBootstrapCheckpoint
$summary.bootstrapPolicyModel = $currentSelfplayPolicyModel
$summary.bootstrapPromotedPolicyModel = $currentPromotedPolicyModel
$summary.bootstrapCheckpoint = $currentResumeCheckpoint
$promotedModelHistory = New-Object System.Collections.Generic.List[string]
if ($currentPromotedPolicyModel) {
    Add-UniqueModelPath -ListRef $promotedModelHistory -ModelPath $currentPromotedPolicyModel
}

if ($currentSelfplayPolicyModel) {
    Write-Output "[deepcfr-cycle] bootstrap policy model: $currentSelfplayPolicyModel"
}
if ($currentPromotedPolicyModel) {
    Write-Output "[deepcfr-cycle] baseline promoted model: $currentPromotedPolicyModel"
}
if ($currentResumeCheckpoint) {
    Write-Output "[deepcfr-cycle] bootstrap checkpoint: $currentResumeCheckpoint"
}

Write-Output "[deepcfr-cycle] start runTag=$RunTag maxHours=$MaxHours deadline=$($deadline.ToString("o"))"

$consecutiveErrors = 0
$nonPromotedStreak = 0
for ($i = 1; $i -le $Iterations; $i++) {
    if ((Get-Date) -ge $deadline) {
        $summary.stoppedByTimeBudget = $true
        $summary.stopReason = "time budget reached before iteration $i"
        break
    }

    $iterTag = "{0}.it{1:D3}" -f $RunTag, $i
    $iterSeed = $Seed + (($i - 1) * $SeedStride)
    $iterCardUsageRate = Resolve-IterationCardUsageRate -Iteration $i -FixedRate $CardUsageRate -Schedule $cardUsageSchedule -Fallback 0.30
    $iterCoverageGateMin = Resolve-CoverageGateMinForIteration -Iteration $i -BaseMin $CoverageGateMin -WarmupMin $CoverageGateWarmupMin -WarmupIterations $CoverageGateWarmupIterations
    $iterPolicyMixRate = if (-not [string]::IsNullOrWhiteSpace($currentSelfplayPolicyModel)) {
        Resolve-IterationScheduledDouble -Iteration $i -Fallback $SelfplayPolicyMixRate -Schedule $policyMixRateSchedule
    } else {
        [double]$SelfplayPolicyMixRateWarmup
    }
    $iterTacticalWeightMin = Resolve-IterationScheduledDouble -Iteration $i -Fallback $SelfplayTacticalWeightMin -Schedule $tacticalWeightMinSchedule
    $iterTacticalWeightMax = Resolve-IterationScheduledDouble -Iteration $i -Fallback $SelfplayTacticalWeightMax -Schedule $tacticalWeightMaxSchedule
    if ($iterTacticalWeightMax -lt $iterTacticalWeightMin) { $iterTacticalWeightMax = $iterTacticalWeightMin }
    $iterPolicyScoreWeightMin = Resolve-IterationScheduledDouble -Iteration $i -Fallback $SelfplayPolicyScoreWeightMin -Schedule $policyScoreWeightMinSchedule
    $iterPolicyScoreWeightMax = Resolve-IterationScheduledDouble -Iteration $i -Fallback $SelfplayPolicyScoreWeightMax -Schedule $policyScoreWeightMaxSchedule
    if ($iterPolicyScoreWeightMax -lt $iterPolicyScoreWeightMin) { $iterPolicyScoreWeightMax = $iterPolicyScoreWeightMin }
    $iterHeuristicWeightMin = Resolve-IterationScheduledDouble -Iteration $i -Fallback $SelfplayHeuristicWeightMin -Schedule $heuristicWeightMinSchedule
    $iterHeuristicWeightMax = Resolve-IterationScheduledDouble -Iteration $i -Fallback $SelfplayHeuristicWeightMax -Schedule $heuristicWeightMaxSchedule
    if ($iterHeuristicWeightMax -lt $iterHeuristicWeightMin) { $iterHeuristicWeightMax = $iterHeuristicWeightMin }
    $iterTacticalDepthOpening = Resolve-IterationScheduledInt -Iteration $i -Fallback $SelfplayTacticalDepthOpening -Schedule $tacticalDepthOpeningSchedule
    $iterTacticalDepthMid = Resolve-IterationScheduledInt -Iteration $i -Fallback $SelfplayTacticalDepthMid -Schedule $tacticalDepthMidSchedule
    $iterTacticalDepthEnd = Resolve-IterationScheduledInt -Iteration $i -Fallback $SelfplayTacticalDepthEnd -Schedule $tacticalDepthEndSchedule
    $iterTacticalBeamWidth = Resolve-IterationScheduledInt -Iteration $i -Fallback $SelfplayTacticalBeamWidth -Schedule $tacticalBeamWidthSchedule
    $iterEscalated = $false
    if ($NoPromotionEscalateAfter -gt 0 -and $nonPromotedStreak -ge $NoPromotionEscalateAfter) {
        $iterEscalated = $true
        $iterCardUsageRate = [Math]::Min(0.98, ($iterCardUsageRate + $NoPromotionCardUsageBoost))
        $iterPolicyMixRate = [Math]::Max(0.35, ($iterPolicyMixRate - $NoPromotionPolicyMixPenalty))
        $iterTacticalDepthMid = [int]($iterTacticalDepthMid + $NoPromotionDepthBoost)
        $iterTacticalDepthEnd = [int]($iterTacticalDepthEnd + $NoPromotionDepthBoost)
        $iterTacticalBeamWidth = [int]($iterTacticalBeamWidth + $NoPromotionBeamBoost)
    }
    $entry = [ordered]@{
        iteration = $i
        tag = $iterTag
        seed = $iterSeed
        nonPromotedStreakStart = $nonPromotedStreak
        escalatedExploration = $iterEscalated
        cardUsageRate = $iterCardUsageRate
        coverageGateMin = $iterCoverageGateMin
        policyMixRate = $iterPolicyMixRate
        cardUsageRateJitter = $SelfplayCardUsageRateJitter
        tacticalWeightMin = $iterTacticalWeightMin
        tacticalWeightMax = $iterTacticalWeightMax
        policyScoreWeightMin = $iterPolicyScoreWeightMin
        policyScoreWeightMax = $iterPolicyScoreWeightMax
        heuristicWeightMin = $iterHeuristicWeightMin
        heuristicWeightMax = $iterHeuristicWeightMax
        tacticalDepthOpening = $iterTacticalDepthOpening
        tacticalDepthMid = $iterTacticalDepthMid
        tacticalDepthEnd = $iterTacticalDepthEnd
        tacticalBeamWidth = $iterTacticalBeamWidth
        startedAt = (Get-Date).ToString("o")
        selfplayPolicyModel = $currentSelfplayPolicyModel
        promotedPolicyModel = $currentPromotedPolicyModel
        resumeCheckpoint = $currentResumeCheckpoint
        currentStep = "start"
        adoptionThreshold = $Threshold
        adoptionBaselineModel = $null
        coverageRate = $null
        coveragePassed = $false
        quickUplift = $null
        finalUplift = $null
        quickPassed = $false
        finalPassed = $false
        adoptionPoolModels = @()
        adoptionPoolPassCount = 0
        adoptionPoolRequiredPassCount = 0
        adoptionPoolMinUplift = $null
        adoptionPoolPassed = $true
        onnxGatePassed = $false
        onnxGateAttempts = 0
        promoted = $false
        candidatePolicyModel = $null
        candidateCardModel = $null
        cardSpecialistTrained = $false
        nextSelfplayPolicyModel = $currentSelfplayPolicyModel
        error = $null
    }
    Write-Output "[deepcfr-cycle] iteration $i/$Iterations start tag=$iterTag seed=$iterSeed cardUsageRate=$iterCardUsageRate policyMixRate=$iterPolicyMixRate tacticalDepth=$iterTacticalDepthOpening/$iterTacticalDepthMid/$iterTacticalDepthEnd beam=$iterTacticalBeamWidth escalated=$iterEscalated nonPromotedStreak=$nonPromotedStreak"
    Write-Output "[deepcfr-cycle] iteration $i selfplay teacher model: $($currentSelfplayPolicyModel)"

    $trainPath = "data/runs/selfplay.train.$iterTag.ndjson"
    $evalPath = "data/runs/selfplay.eval.$iterTag.ndjson"
    $candidateOnnx = "data/models/policy-net.candidate.$iterTag.onnx"
    $candidateMeta = "data/models/policy-net.candidate.$iterTag.onnx.meta.json"
    $candidateCardOnnx = "data/models/policy-card.candidate.$iterTag.onnx"
    $candidateCardMeta = "data/models/policy-card.candidate.$iterTag.onnx.meta.json"
    $candidateCardTable = "data/models/policy-table.card-specialist.$iterTag.json"
    $candidateTable = "data/models/policy-table.candidate.$iterTag.json"
    $candidateCkpt = "data/models/policy-net.candidate.$iterTag.checkpoint.pt"
    $candidateCardCkpt = "data/models/policy-card.candidate.$iterTag.checkpoint.pt"
    $metricsOut = "data/runs/train.metrics.$iterTag.jsonl"
    $reportOut = "data/runs/train.report.$iterTag.json"
    $cardMetricsOut = "data/runs/train.card.metrics.$iterTag.jsonl"
    $cardReportOut = "data/runs/train.card.report.$iterTag.json"
    $evalReportOut = "data/runs/eval.policy.$iterTag.json"
    $quickOut = "data/runs/adoption.quick.$iterTag.json"
    $finalOut = "data/runs/adoption.final.$iterTag.json"
    $onnxGateOut = "data/runs/adoption.onnx.$iterTag.json"

    try {
        $entry.currentStep = "generate-train"
        $trainSelfplayArgs = @(
            "scripts/generate-selfplay-data-parallel.js",
            "--games","$TrainGames",
            "--seed","$iterSeed",
            "--seed-stride","$SelfplaySeedStride",
            "--workers","$SelfplayWorkers",
            "--max-plies","$MaxPlies",
            "--out",$trainPath,
            "--with-cards",
            "--card-usage-rate","$iterCardUsageRate",
            "--policy-mix-rate","$iterPolicyMixRate",
            "--card-usage-rate-jitter","$SelfplayCardUsageRateJitter",
            "--tactical-weight-min","$iterTacticalWeightMin",
            "--tactical-weight-max","$iterTacticalWeightMax",
            "--policy-score-weight-min","$iterPolicyScoreWeightMin",
            "--policy-score-weight-max","$iterPolicyScoreWeightMax",
            "--heuristic-weight-min","$iterHeuristicWeightMin",
            "--heuristic-weight-max","$iterHeuristicWeightMax",
            "--tactical-depth-opening","$iterTacticalDepthOpening",
            "--tactical-depth-mid","$iterTacticalDepthMid",
            "--tactical-depth-end","$iterTacticalDepthEnd",
            "--tactical-beam-width","$iterTacticalBeamWidth"
        )
        if ($currentSelfplayPolicyModel) {
            $trainSelfplayArgs += @("--policy-model",$currentSelfplayPolicyModel)
        }
        Run-Strict "node" $trainSelfplayArgs

        $entry.currentStep = "generate-eval"
        $evalSelfplayArgs = @(
            "scripts/generate-selfplay-data-parallel.js",
            "--games","$EvalGames",
            "--seed","$($iterSeed + 100000)",
            "--seed-stride","$SelfplaySeedStride",
            "--workers","$EvalWorkers",
            "--max-plies","$MaxPlies",
            "--out",$evalPath,
            "--with-cards",
            "--card-usage-rate","$iterCardUsageRate",
            "--policy-mix-rate","$iterPolicyMixRate",
            "--card-usage-rate-jitter","$SelfplayCardUsageRateJitter",
            "--tactical-weight-min","$iterTacticalWeightMin",
            "--tactical-weight-max","$iterTacticalWeightMax",
            "--policy-score-weight-min","$iterPolicyScoreWeightMin",
            "--policy-score-weight-max","$iterPolicyScoreWeightMax",
            "--heuristic-weight-min","$iterHeuristicWeightMin",
            "--heuristic-weight-max","$iterHeuristicWeightMax",
            "--tactical-depth-opening","$iterTacticalDepthOpening",
            "--tactical-depth-mid","$iterTacticalDepthMid",
            "--tactical-depth-end","$iterTacticalDepthEnd",
            "--tactical-beam-width","$iterTacticalBeamWidth"
        )
        if ($currentSelfplayPolicyModel) {
            $evalSelfplayArgs += @("--policy-model",$currentSelfplayPolicyModel)
        }
        Run-Strict "node" $evalSelfplayArgs

        $entry.currentStep = "train-deepcfr"
        $trainArgs = @(".\ai\train\train_deepcfr_onnx.py","--input",$trainPath,"--onnx-out",$candidateOnnx,"--meta-out",$candidateMeta,"--policy-table-out",$candidateTable,"--report-out",$reportOut,"--metrics-out",$metricsOut,"--checkpoint-out",$candidateCkpt,"--cfr-iterations","$CfrIterations","--max-samples","$MaxSamples","--epochs","$Epochs","--batch-size","$BatchSize","--lr","$Lr","--hidden-size","$HiddenSize","--card-loss-weight","$CardLossWeight","--card-no-action-weight","$CardNoActionWeight","--card-class-balance-power","$CardClassBalancePower","--val-split","$ValSplit","--early-stop-patience","$EarlyStopPatience","--early-stop-min-delta","$EarlyStopMinDelta","--early-stop-monitor",$EarlyStopMonitor,"--early-stop-min-epochs","$EarlyStopMinEpochs","--lr-plateau-patience","$LrPlateauPatience","--lr-plateau-factor","$LrPlateauFactor","--lr-plateau-min-lr","$LrPlateauMinLr","--min-visits","$MinVisits","--shape-immediate","$ShapeImmediate","--device",$Device)
        if ($currentResumeCheckpoint) {
            $trainArgs += @("--resume-checkpoint",$currentResumeCheckpoint)
            if ($ResumeModelOnly) {
                $trainArgs += @("--resume-model-only")
            }
        }
        Run-Strict ".\.venv\Scripts\python.exe" $trainArgs

        if (Test-Path $candidateTable) {
            $entry.candidatePolicyModel = (Resolve-RepoPath $candidateTable)
            if (-not $SelfplayUsePromotedModelOnly) {
                $currentSelfplayPolicyModel = $entry.candidatePolicyModel
                $entry.nextSelfplayPolicyModel = $currentSelfplayPolicyModel
            }
        }
        if (Test-Path $candidateCkpt) {
            $currentResumeCheckpoint = (Resolve-RepoPath $candidateCkpt)
        }

        if ($EnableCardSpecialist) {
            $entry.currentStep = "train-card-specialist"
            $cardTrainArgs = @(
                ".\ai\train\train_deepcfr_onnx.py",
                "--input",$trainPath,
                "--onnx-out",$candidateCardOnnx,
                "--meta-out",$candidateCardMeta,
                "--policy-table-out",$candidateCardTable,
                "--report-out",$cardReportOut,
                "--metrics-out",$cardMetricsOut,
                "--checkpoint-out",$candidateCardCkpt,
                "--cfr-iterations","$CfrIterations",
                "--max-samples","$MaxSamples",
                "--epochs","$CardSpecialistEpochs",
                "--batch-size","$BatchSize",
                "--lr","$Lr",
                "--hidden-size","$HiddenSize",
                "--place-loss-weight","$CardSpecialistPlaceLossWeight",
                "--card-loss-weight","$CardSpecialistCardLossWeight",
                "--card-no-action-weight","$CardSpecialistNoActionWeight",
                "--card-class-balance-power","$CardSpecialistClassBalancePower",
                "--val-split","$ValSplit",
                "--early-stop-patience","$CardSpecialistEarlyStopPatience",
                "--early-stop-min-delta","$CardSpecialistEarlyStopMinDelta",
                "--early-stop-monitor",$CardSpecialistEarlyStopMonitor,
                "--early-stop-min-epochs","$CardSpecialistEarlyStopMinEpochs",
                "--lr-plateau-patience","$CardSpecialistLrPlateauPatience",
                "--lr-plateau-factor","$CardSpecialistLrPlateauFactor",
                "--lr-plateau-min-lr","$CardSpecialistLrPlateauMinLr",
                "--min-visits","$MinVisits",
                "--shape-immediate","$ShapeImmediate",
                "--device",$Device
            )
            if (Test-Path $candidateCkpt) {
                $cardTrainArgs += @("--resume-checkpoint",$candidateCkpt,"--resume-model-only")
            } elseif ($currentResumeCheckpoint) {
                $cardTrainArgs += @("--resume-checkpoint",$currentResumeCheckpoint)
                if ($ResumeModelOnly) {
                    $cardTrainArgs += @("--resume-model-only")
                }
            }
            Run-Strict ".\.venv\Scripts\python.exe" $cardTrainArgs
            if ((Test-Path $candidateCardOnnx) -and (Test-Path $candidateCardMeta)) {
                $entry.cardSpecialistTrained = $true
                $entry.candidateCardModel = (Resolve-RepoPath $candidateCardOnnx)
            }
        }

        $entry.currentStep = "evaluate-policy-table"
        Run-Strict ".\.venv\Scripts\python.exe" @(".\ai\train\evaluate_policy_table.py","--input",$evalPath,"--model",$candidateTable,"--out",$evalReportOut)
        if (Test-Path $evalReportOut) {
            $evalPolicy = Get-Content $evalReportOut -Raw | ConvertFrom-Json
            $coverageRate = $null
            try {
                if ($evalPolicy -and $evalPolicy.result -and $evalPolicy.result.coverageRate -ne $null) {
                    $coverageRate = [double]$evalPolicy.result.coverageRate
                }
            } catch {
                $coverageRate = $null
            }
            $entry.coverageRate = $coverageRate
            $entry.coveragePassed = (-not $CoverageGateEnabled) -or ($coverageRate -ne $null -and $coverageRate -ge $iterCoverageGateMin)
            if (-not $entry.coveragePassed) {
                $nonPromotedStreak += 1
                $entry.finishedAt = (Get-Date).ToString("o")
                $summary.entries += $entry
                $summary.iterationsCompleted = $i
                $consecutiveErrors = 0
                Write-Output "[deepcfr-cycle] iteration $i coverage gate failed coverage=$coverageRate min=$iterCoverageGateMin (base=$CoverageGateMin warmupMin=$CoverageGateWarmupMin warmupIterations=$CoverageGateWarmupIterations)"

                $stall = Test-UpliftStall -Entries $summary.entries -Window $UpliftStallWindow -MinDelta $UpliftStallMinDelta -MinIterations $UpliftStallMinIterations
                if ($stall.stop) {
                    $summary.stopReason = $stall.reason
                    Write-Output "[deepcfr-cycle] stop: $($stall.reason)"
                    break
                }
                continue
            }
        } else {
            throw "[deepcfr-cycle] evaluate report missing: $evalReportOut"
        }

        $adoptionThreshold = $Threshold
        $adoptionBaselineModel = $null
        if ($AdoptionCompareWithPromoted -and $currentPromotedPolicyModel -and (Test-Path $currentPromotedPolicyModel)) {
            $adoptionThreshold = $AdoptionRelativeThreshold
            $adoptionBaselineModel = $currentPromotedPolicyModel
        }
        $entry.adoptionThreshold = $adoptionThreshold
        $entry.adoptionBaselineModel = $adoptionBaselineModel
        if ($adoptionBaselineModel) {
            Write-Output "[deepcfr-cycle] iteration $i adoption baseline: promoted model ($adoptionBaselineModel) threshold=$adoptionThreshold"
        } else {
            Write-Output "[deepcfr-cycle] iteration $i adoption baseline: empty-model baseline threshold=$adoptionThreshold"
        }

        $entry.currentStep = "adoption-quick"
        $quickArgs = @(
            "scripts/benchmark-policy-adoption.js",
            "--games","$QuickGames",
            "--seed","$iterSeed",
            "--seed-count","$AdoptionSeedCount",
            "--seed-stride","$AdoptionSeedStride",
            "--jobs","$AdoptionJobs",
            "--progress-every","$AdoptionProgressEvery",
            "--max-plies","$MaxPlies",
            "--threshold","$adoptionThreshold",
            "--min-seed-uplift","$AdoptionMinSeedUplift",
            "--min-seed-pass-count","$AdoptionMinSeedPassCount",
            "--white-priority","$AdoptionWhitePriority",
            "--quality-weight-corner","$AdoptionQualityWeightCorner",
            "--quality-weight-bonus","$AdoptionQualityWeightBonus",
            "--quality-weight-card-immediate","$AdoptionQualityWeightCardImmediate",
            "--quality-weight-place-delta","$AdoptionQualityWeightPlaceDelta",
            "--a-rate","$iterCardUsageRate",
            "--b-rate","$iterCardUsageRate",
            "--tactical-weight","$AdoptionTacticalWeight",
            "--tactical-depth-opening","$iterTacticalDepthOpening",
            "--tactical-depth-mid","$iterTacticalDepthMid",
            "--tactical-depth-end","$iterTacticalDepthEnd",
            "--tactical-beam-width","$iterTacticalBeamWidth",
            "--policy-score-weight","$AdoptionPolicyScoreWeight",
            "--heuristic-weight","$AdoptionHeuristicWeight",
            "--candidate-model",$candidateTable,
            "--out",$quickOut
        )
        if ($adoptionBaselineModel) {
            $quickArgs += @("--baseline-model",$adoptionBaselineModel)
            $quickArgs += @("--opponent-model",$adoptionBaselineModel)
        }
        Run-AllowDecision "node" $quickArgs
        $quick = Get-Content $quickOut -Raw | ConvertFrom-Json
        if ($quick -and $quick.decision -and $quick.decision.uplift -ne $null) {
            $entry.quickUplift = [double]$quick.decision.uplift
        }
        $entry.quickPassed = ($quick.decision.passed -eq $true)
        if (-not $entry.quickPassed) {
            $nonPromotedStreak += 1
            $entry.finishedAt = (Get-Date).ToString("o")
            $summary.entries += $entry
            $summary.iterationsCompleted = $i
            $consecutiveErrors = 0
            Write-Output "[deepcfr-cycle] iteration $i quick failed"

            $stall = Test-UpliftStall -Entries $summary.entries -Window $UpliftStallWindow -MinDelta $UpliftStallMinDelta -MinIterations $UpliftStallMinIterations
            if ($stall.stop) {
                $summary.stopReason = $stall.reason
                Write-Output "[deepcfr-cycle] stop: $($stall.reason)"
                break
            }
            continue
        }

        $entry.currentStep = "adoption-final"
        $finalArgs = @(
            "scripts/benchmark-policy-adoption.js",
            "--games","$FinalGames",
            "--seed","$($iterSeed + $AdoptionFinalSeedOffset)",
            "--seed-count","$AdoptionSeedCount",
            "--seed-stride","$AdoptionSeedStride",
            "--jobs","$AdoptionJobs",
            "--progress-every","$AdoptionProgressEvery",
            "--max-plies","$MaxPlies",
            "--threshold","$adoptionThreshold",
            "--min-seed-uplift","$AdoptionMinSeedUplift",
            "--min-seed-pass-count","$AdoptionMinSeedPassCount",
            "--white-priority","$AdoptionWhitePriority",
            "--quality-weight-corner","$AdoptionQualityWeightCorner",
            "--quality-weight-bonus","$AdoptionQualityWeightBonus",
            "--quality-weight-card-immediate","$AdoptionQualityWeightCardImmediate",
            "--quality-weight-place-delta","$AdoptionQualityWeightPlaceDelta",
            "--a-rate","$iterCardUsageRate",
            "--b-rate","$iterCardUsageRate",
            "--tactical-weight","$AdoptionTacticalWeight",
            "--tactical-depth-opening","$iterTacticalDepthOpening",
            "--tactical-depth-mid","$iterTacticalDepthMid",
            "--tactical-depth-end","$iterTacticalDepthEnd",
            "--tactical-beam-width","$iterTacticalBeamWidth",
            "--policy-score-weight","$AdoptionPolicyScoreWeight",
            "--heuristic-weight","$AdoptionHeuristicWeight",
            "--candidate-model",$candidateTable,
            "--out",$finalOut
        )
        if ($adoptionBaselineModel) {
            $finalArgs += @("--baseline-model",$adoptionBaselineModel)
            $finalArgs += @("--opponent-model",$adoptionBaselineModel)
        }
        Run-AllowDecision "node" $finalArgs
        $final = Get-Content $finalOut -Raw | ConvertFrom-Json
        if ($final -and $final.decision -and $final.decision.uplift -ne $null) {
            $entry.finalUplift = [double]$final.decision.uplift
        }
        $entry.finalPassed = ($final.decision.passed -eq $true)
        if (-not $entry.finalPassed) {
            $nonPromotedStreak += 1
            $entry.finishedAt = (Get-Date).ToString("o")
            $summary.entries += $entry
            $summary.iterationsCompleted = $i
            $consecutiveErrors = 0
            Write-Output "[deepcfr-cycle] iteration $i final failed"

            $stall = Test-UpliftStall -Entries $summary.entries -Window $UpliftStallWindow -MinDelta $UpliftStallMinDelta -MinIterations $UpliftStallMinIterations
            if ($stall.stop) {
                $summary.stopReason = $stall.reason
                Write-Output "[deepcfr-cycle] stop: $($stall.reason)"
                break
            }
            continue
        }

        if ($AdoptionPoolGateEnabled -and $AdoptionPoolSize -gt 0) {
            $entry.currentStep = "adoption-pool"
            $poolModels = @(Get-AdoptionBaselinePool -History $promotedModelHistory -CurrentPromotedModel $currentPromotedPolicyModel -CandidateModel $candidateTable -PoolSize $AdoptionPoolSize)
            $entry.adoptionPoolModels = @($poolModels)
            if ($poolModels.Count -gt 0) {
                $poolGamesToUse = if ($AdoptionPoolGames -gt 0) { $AdoptionPoolGames } else { $FinalGames }
                $poolSeedBase = $iterSeed + $AdoptionPoolSeedOffset
                $poolPassCount = 0
                $poolMinUplift = $null
                $poolRequired = if ($AdoptionPoolRequiredPassCount -gt 0) {
                    [Math]::Min($AdoptionPoolRequiredPassCount, $poolModels.Count)
                } else {
                    $poolModels.Count
                }
                $entry.adoptionPoolRequiredPassCount = $poolRequired

                for ($poolIdx = 0; $poolIdx -lt $poolModels.Count; $poolIdx++) {
                    $baselinePath = $poolModels[$poolIdx]
                    $poolOut = "data/runs/adoption.pool.$iterTag.b$($poolIdx + 1).json"
                    $poolArgs = @(
                        "scripts/benchmark-policy-adoption.js",
                        "--games","$poolGamesToUse",
                        "--seed","$($poolSeedBase + ($poolIdx * 10000))",
                        "--seed-count","$AdoptionSeedCount",
                        "--seed-stride","$AdoptionSeedStride",
                        "--jobs","$AdoptionJobs",
                        "--progress-every","$AdoptionProgressEvery",
                        "--max-plies","$MaxPlies",
                        "--threshold","$AdoptionPoolThreshold",
                        "--min-seed-uplift","$AdoptionPoolMinSeedUplift",
                        "--min-seed-pass-count","$AdoptionPoolMinSeedPassCount",
                        "--white-priority","$AdoptionWhitePriority",
                        "--quality-weight-corner","$AdoptionQualityWeightCorner",
                        "--quality-weight-bonus","$AdoptionQualityWeightBonus",
                        "--quality-weight-card-immediate","$AdoptionQualityWeightCardImmediate",
                        "--quality-weight-place-delta","$AdoptionQualityWeightPlaceDelta",
                        "--a-rate","$iterCardUsageRate",
                        "--b-rate","$iterCardUsageRate",
                        "--tactical-weight","$AdoptionTacticalWeight",
                        "--tactical-depth-opening","$iterTacticalDepthOpening",
                        "--tactical-depth-mid","$iterTacticalDepthMid",
                        "--tactical-depth-end","$iterTacticalDepthEnd",
                        "--tactical-beam-width","$iterTacticalBeamWidth",
                        "--policy-score-weight","$AdoptionPolicyScoreWeight",
                        "--heuristic-weight","$AdoptionHeuristicWeight",
                        "--baseline-model",$baselinePath,
                        "--opponent-model",$baselinePath,
                        "--candidate-model",$candidateTable,
                        "--out",$poolOut
                    )
                    Run-AllowDecision "node" $poolArgs
                    $poolResult = Get-Content $poolOut -Raw | ConvertFrom-Json
                    $poolDecision = $poolResult.decision
                    if ($poolDecision -and $poolDecision.uplift -ne $null) {
                        $u = [double]$poolDecision.uplift
                        if ($poolMinUplift -eq $null -or $u -lt $poolMinUplift) {
                            $poolMinUplift = $u
                        }
                    }
                    if ($poolDecision -and $poolDecision.passed -eq $true) {
                        $poolPassCount += 1
                    }
                }

                $entry.adoptionPoolPassCount = $poolPassCount
                $entry.adoptionPoolMinUplift = $poolMinUplift
                $entry.adoptionPoolPassed = ($poolPassCount -ge $poolRequired)
                if (-not $entry.adoptionPoolPassed) {
                    $nonPromotedStreak += 1
                    $entry.finishedAt = (Get-Date).ToString("o")
                    $summary.entries += $entry
                    $summary.iterationsCompleted = $i
                    $consecutiveErrors = 0
                    Write-Output "[deepcfr-cycle] iteration $i pool gate failed pass=$poolPassCount/$poolRequired min_uplift=$poolMinUplift"
                    continue
                }
                Write-Output "[deepcfr-cycle] iteration $i pool gate passed pass=$poolPassCount/$poolRequired min_uplift=$poolMinUplift"
            } else {
                $entry.adoptionPoolRequiredPassCount = 0
                $entry.adoptionPoolPassCount = 0
                $entry.adoptionPoolMinUplift = $null
                $entry.adoptionPoolPassed = $true
                Write-Output "[deepcfr-cycle] iteration $i pool gate skipped (no baseline models available yet)"
            }
        }

        $entry.currentStep = "onnx-gate"
        $gatePassed = $false
        for ($gateAttempt = 1; $gateAttempt -le $OnnxGateRetries; $gateAttempt++) {
            $entry.onnxGateAttempts = $gateAttempt
            $gateArgs = @(
                "scripts/benchmark-policy-onnx-gate.js",
                "--games","$OnnxGateGames",
                "--seed","$($iterSeed + $OnnxGateSeedOffset)",
                "--seed-count","$OnnxGateSeedCount",
                "--seed-stride","$OnnxGateSeedStride",
                "--jobs","$OnnxGateJobs",
                "--threshold","$OnnxGateThreshold",
                "--min-seed-score","$OnnxGateMinSeedScore",
                "--min-seed-pass-count","$OnnxGateMinSeedPassCount",
                "--timeout-ms","$OnnxGateTimeoutMs",
                "--match-retries","$OnnxGateMatchRetries",
                "--max-total-ms","$OnnxGateMaxTotalMs",
                "--black-level","$OnnxGateBlackLevel",
                "--white-level","$OnnxGateWhiteLevel",
                "--candidate-color-mode",$OnnxGateCandidateColorMode,
                "--candidate-onnx",$candidateOnnx,
                "--candidate-onnx-meta",$candidateMeta
            )
            if ($EnableCardSpecialist -and (Test-Path $candidateCardOnnx) -and (Test-Path $candidateCardMeta)) {
                $gateArgs += @("--candidate-card-onnx",$candidateCardOnnx,"--candidate-card-onnx-meta",$candidateCardMeta)
            }
            $gateArgs += @("--out",$onnxGateOut)
            Run-AllowDecision "node" $gateArgs
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
            $nonPromotedStreak += 1
            $entry.finishedAt = (Get-Date).ToString("o")
            $summary.entries += $entry
            $summary.iterationsCompleted = $i
            $consecutiveErrors = 0
            Write-Output "[deepcfr-cycle] iteration $i onnx gate failed"
            continue
        }

        $entry.currentStep = "promote"
        Run-Strict "node" @("scripts/promote-policy-model.js","--adoption-result",$finalOut,"--candidate-model",$candidateTable,"--candidate-onnx",$candidateOnnx,"--candidate-onnx-meta",$candidateMeta)
        if ($EnableCardSpecialist -and (Test-Path $candidateCardOnnx) -and (Test-Path $candidateCardMeta)) {
            $promotedCardOnnx = Resolve-RepoPath "data/models/policy-card.onnx"
            $promotedCardMeta = Resolve-RepoPath "data/models/policy-card.onnx.meta.json"
            Copy-Item -LiteralPath $candidateCardOnnx -Destination $promotedCardOnnx -Force
            Copy-Item -LiteralPath $candidateCardMeta -Destination $promotedCardMeta -Force
            $entry.promotedCardModel = $promotedCardOnnx
            Write-Output "[deepcfr-cycle] promoted card specialist -> $promotedCardOnnx"
        }
        $entry.promoted = $true
        $promotedPolicyModelPath = Resolve-RepoPath "data/models/policy-table.json"
        if (Test-Path $promotedPolicyModelPath) {
            $currentSelfplayPolicyModel = $promotedPolicyModelPath
            $currentPromotedPolicyModel = $promotedPolicyModelPath
        } elseif ($entry.candidatePolicyModel) {
            # Fallback: keep loop alive even if promoted target path is unexpectedly missing.
            $currentSelfplayPolicyModel = $entry.candidatePolicyModel
            $currentPromotedPolicyModel = $entry.candidatePolicyModel
        }
        if ($currentPromotedPolicyModel) {
            Add-UniqueModelPath -ListRef $promotedModelHistory -ModelPath $currentPromotedPolicyModel
        }
        $entry.nextSelfplayPolicyModel = $currentSelfplayPolicyModel
        $entry.finishedAt = (Get-Date).ToString("o")
        $summary.entries += $entry
        $summary.iterationsCompleted = $i
        $nonPromotedStreak = 0
        $consecutiveErrors = 0
        Write-Output "[deepcfr-cycle] iteration $i promoted"

        $stall = Test-UpliftStall -Entries $summary.entries -Window $UpliftStallWindow -MinDelta $UpliftStallMinDelta -MinIterations $UpliftStallMinIterations
        if ($stall.stop) {
            $summary.stopReason = $stall.reason
            Write-Output "[deepcfr-cycle] stop: $($stall.reason)"
            break
        }
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
}
finally {
    if ($lockAcquired) {
        Release-RunLock -LockPath $lockPath -OwnerPid $PID
    }
}
