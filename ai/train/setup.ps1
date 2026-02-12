param(
    [switch]$CpuOnly,
    [switch]$SkipTorch,
    [switch]$WithVisionAudio,
    [string]$TorchVersion = "2.6.0",
    [string]$CudaTag = "cu124"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
$requirements = Join-Path $PSScriptRoot "requirements.txt"

if (-not (Test-Path $pythonExe)) {
    throw "Python executable was not found: $pythonExe"
}

function Test-NvidiaGpu {
    try {
        $cmd = Get-Command nvidia-smi -ErrorAction SilentlyContinue
        if (-not $cmd) { return $false }
        $null = & $cmd.Source --query-gpu=name --format=csv,noheader 2>$null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

Write-Host "[py-setup] python: $pythonExe"
& $pythonExe --version

Write-Host "[py-setup] upgrading pip/setuptools/wheel"
& $pythonExe -m pip install --upgrade pip setuptools wheel

if (-not $SkipTorch) {
    $hasGpu = (-not $CpuOnly) -and (Test-NvidiaGpu)
    $torchPkgs = @("torch==$TorchVersion")
    if ($WithVisionAudio) {
        $torchPkgs += @("torchvision==0.21.0", "torchaudio==2.6.0")
    }
    if ($hasGpu) {
        $torchIndex = "https://download.pytorch.org/whl/$CudaTag"
        Write-Host "[py-setup] installing $($torchPkgs -join ', ') (CUDA: $CudaTag)"
        try {
            & $pythonExe -m pip install @torchPkgs --index-url $torchIndex
        } catch {
            Write-Warning "[py-setup] CUDA torch install failed. Falling back to CPU wheels."
            & $pythonExe -m pip install @torchPkgs
        }
    } else {
        Write-Host "[py-setup] installing $($torchPkgs -join ', ') (CPU)"
        & $pythonExe -m pip install @torchPkgs
    }
}

Write-Host "[py-setup] installing requirements from: $requirements"
& $pythonExe -m pip install -r $requirements

Write-Host "[py-setup] torch/cuda check"
$torchCheckScript = @'
import sys
try:
    import torch
except Exception as e:
    print("[py-setup] torch import failed:", e)
    sys.exit(1)
print("[py-setup] torch:", torch.__version__)
print("[py-setup] cuda_available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("[py-setup] cuda_device_count:", torch.cuda.device_count())
    print("[py-setup] cuda_device_name:", torch.cuda.get_device_name(0))
'@
$torchCheckScript | & $pythonExe -

Write-Host "[py-setup] done"
