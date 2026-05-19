param(
    [string]$RunTag = ("fulltrain_teacher_v23_resume_{0}" -f (Get-Date -Format 'yyyyMMdd_HHmmss')),
    [int]$Seed = 1001,
    [switch]$Preview
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$logPath = Join-Path $repoRoot ("data/runs/training.{0}.log" -f $RunTag)
$errPath = Join-Path $repoRoot ("data/runs/training.{0}.err.log" -f $RunTag)

$nodeCommand = @(
    'scripts/run-selfplay-training-preset.js'
    '--profile'
    'cards_v2_rootfix'
    '--'
    '--run-tag'
    $RunTag
    '--seed'
    $Seed
) | ForEach-Object {
    if ($_ -match '\s') { '"{0}"' -f $_ } else { $_ }
}

$commandLine = 'node {0} 1>> "{1}" 2>> "{2}"' -f ($nodeCommand -join ' '), $logPath, $errPath

if ($Preview) {
    Write-Output ("RunTag: {0}" -f $RunTag)
    Write-Output ("Command: {0}" -f $commandLine)
    return
}

Set-Location $repoRoot

$process = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', $commandLine `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden `
    -PassThru

Write-Output ("Started PID={0}" -f $process.Id)
Write-Output ("Log: {0}" -f $logPath)
Write-Output ("Err: {0}" -f $errPath)
