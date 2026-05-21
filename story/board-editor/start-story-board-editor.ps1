param(
  [int]$PreferredPort = 8137,
  [int]$MaxPort = 8155,
  [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'

function Test-StoryBoardEditorUrl {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
      return $false
    }
    return [string]$response.Content -like '*id="storyBoardEditorShell"*'
  } catch {
    return $false
  }
}

function Test-PortAvailable {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse('127.0.0.1'), $Port)
  try {
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    try {
      $listener.Stop()
    } catch {
    }
  }
}

$editorDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path (Join-Path $editorDir '..\..')).Path
$serveScript = Join-Path $rootDir 'scripts\serve-with-fallback.js'
$editorPath = '/story/board-editor/index.html'
$preferredUrl = "http://127.0.0.1:$PreferredPort$editorPath"

if (-not (Test-Path $serveScript)) {
  throw "serve-with-fallback.js was not found: $serveScript"
}

if (Test-StoryBoardEditorUrl -Url $preferredUrl) {
  if (-not $NoOpen) {
    Start-Process $preferredUrl | Out-Null
  }
  Write-Host "story board editor: $preferredUrl"
  Write-Host "status: already running"
  exit 0
}

$selectedPort = $null
for ($candidate = $PreferredPort; $candidate -le $MaxPort; $candidate += 1) {
  if (Test-PortAvailable -Port $candidate) {
    $selectedPort = $candidate
    break
  }
}

if ($null -eq $selectedPort) {
  throw "No free port was found in range $PreferredPort-$MaxPort."
}

$node = Get-Command node -ErrorAction Stop
$arguments = @(
  $serveScript,
  '.',
  '--host', '127.0.0.1',
  '--port', "$selectedPort",
  '--max-attempts', '0'
)

$serverProcess = Start-Process `
  -FilePath $node.Source `
  -ArgumentList $arguments `
  -WorkingDirectory $rootDir `
  -WindowStyle Hidden `
  -PassThru

$targetUrl = "http://127.0.0.1:$selectedPort$editorPath"
$deadline = (Get-Date).AddSeconds(20)
$ready = $false

while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 300
  if ($serverProcess.HasExited) {
    throw "The local server exited before the editor became ready."
  }
  if (Test-StoryBoardEditorUrl -Url $targetUrl) {
    $ready = $true
    break
  }
}

if (-not $ready) {
  try {
    if (-not $serverProcess.HasExited) {
      Stop-Process -Id $serverProcess.Id -Force
    }
  } catch {
  }
  throw "Timed out while waiting for the local server to become ready."
}

if (-not $NoOpen) {
  Start-Process $targetUrl | Out-Null
}

Write-Host "story board editor: $targetUrl"
Write-Host "server pid: $($serverProcess.Id)"
