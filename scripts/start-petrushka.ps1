$ErrorActionPreference = 'Stop'
$gameRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $env:LOCALAPPDATA 'hermes-desktop\.env'
if (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Port 3001 is already running. Stop the existing game process before starting another.'
}
$tokenLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^\s*TELEGRAM_BOT_TOKEN\s*=' } | Select-Object -First 1
if (-not $tokenLine) { throw 'Telegram bot credential is missing.' }
$gameToken = ($tokenLine -replace '^\s*TELEGRAM_BOT_TOKEN\s*=\s*', '').Trim().Trim('"', "'")
if (-not $gameToken) { throw 'Telegram bot credential is empty.' }
$logDir = Join-Path $gameRoot 'data'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$savedEnv = @{}
foreach ($key in @('BOT_TOKEN','PORT','GAME_HOST','GAME_DATA_FILE')) { $savedEnv[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
try {
    $env:BOT_TOKEN = $gameToken
    $env:PORT = '3001'
    $env:GAME_HOST = '127.0.0.1'
    $env:GAME_DATA_FILE = Join-Path $logDir 'world.json'
    $process = Start-Process -FilePath (Get-Command node).Source -ArgumentList 'server.mjs' -WorkingDirectory $gameRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'server.log') -RedirectStandardError (Join-Path $logDir 'server-error.log') -PassThru
    Write-Output "Game process started: $($process.Id)"
} finally {
    foreach ($key in $savedEnv.Keys) { [Environment]::SetEnvironmentVariable($key, $savedEnv[$key], 'Process') }
    $gameToken = $null
}
