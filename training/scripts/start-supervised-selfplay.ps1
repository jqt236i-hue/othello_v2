param([Parameter(Mandatory=$true)][string]$ConfigPath)
$ErrorActionPreference = 'Stop'
# Hold only a process-scoped sleep request; leave the user's power plan unchanged.
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class TrainingPower {
    [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);
}
'@
$repoPath = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
try {
    [void][TrainingPower]::SetThreadExecutionState(2147483649)
    Set-Location -LiteralPath $repoPath
    & 'C:\Program Files\nodejs\node.exe' (Join-Path $repoPath 'dist/scripts/supervise-selfplay-training.js') $ConfigPath
    exit $LASTEXITCODE
} finally {
    [void][TrainingPower]::SetThreadExecutionState(2147483648)
}
