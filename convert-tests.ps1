param([string[]]$Files)

foreach ($file in $Files) {
    $jsPath = Join-Path $PWD $file
    if (-not (Test-Path $jsPath)) {
        Write-Host "SKIP: $file not found"
        continue
    }
    
    $content = Get-Content $jsPath -Raw
    $filename = [System.IO.Path]::GetFileNameWithoutExtension($file)
    $tsPath = $jsPath -replace '\.js$', '.ts'
    
    # Determine relative path for wrapper based on file depth
    $depth = ($file -split '[/\\]').Count - 1
    $wrapperPath = "../../dist/test/$filename.js"
    
    # Build TypeScript content
    $tsContent = @"
// TypeScript test file
import type { jest } from '@jest/globals';

declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined') ? __non_webpack_require__! : require;

"@
    
    # Convert require statements to imports
    $lines = $content -split "`n"
    $convertedLines = @()
    foreach ($line in $lines) {
        if ($line -match '^\s*const\s+(\w+)\s+=\s+require\(["''](.+)["'']\);?\s*$') {
            $varName = $matches[1]
            $modulePath = $matches[2]
            $convertedLines += "import * as $varName from '$modulePath';"
        } elseif ($line -match '^\s*const\s+\{([^}]+)\}\s+=\s+require\(["''](.+)["'']\);?\s*$') {
            $imports = $matches[1] -replace '\s+', ' '
            $modulePath = $matches[2]
            $convertedLines += "import { $imports } from '$modulePath';"
        } else {
            $convertedLines += $line
        }
    }
    
    $tsContent += ($convertedLines -join "`n")
    
    # Write TypeScript file
    Set-Content -Path $tsPath -Value $tsContent -NoNewline
    Write-Host "CREATED: $tsPath"
    
    # Create wrapper JS file
    $wrapperContent = @"
"use strict";
/** @type {any} */
module.exports = require('$wrapperPath');
"@
    Set-Content -Path $jsPath -Value $wrapperContent -NoNewline
    Write-Host "WRAPPED: $jsPath"
}
