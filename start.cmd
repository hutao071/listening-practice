@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>&1
if errorlevel 1 goto bundled
node.exe server.mjs
goto done

:bundled
powershell.exe -NoProfile -Command "$runtime = Get-AppxPackage -Name 'OpenAI.CodexPrimaryRuntime*' -ErrorAction SilentlyContinue | Sort-Object Version -Descending | Select-Object -First 1; if ($runtime) { $node = Join-Path $runtime.InstallLocation 'dependencies\node\bin\node.exe'; if (Test-Path -LiteralPath $node) { & $node 'server.mjs'; exit $LASTEXITCODE } }; Write-Host 'Node.js was not found. Install Node.js, then run this file again.'; exit 1"

:done
pause
