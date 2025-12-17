param(
  [string]$BaseUrl = 'http://localhost:3000',
  [string]$EnvStages = '',
  [string]$StageTargets = '',
  [string]$StageDurations = '',
  [int]$P95Ms = 200,
  [double]$ErrorRate = 0.005,
  [switch]$StartServer
)

<#
.SYNOPSIS
  Convenience script to set environment variables and run the full k6 flow (npm run k6:full).

.DESCRIPTION
  Sets common env vars used by the k6 scripts (BASE_URL, ENV_STAGES or STAGE_TARGETS/STAGE_DURATIONS,
  ENV_P95_MS, ENV_ERROR_RATE). Optionally starts the API server (node app.js) in background, runs
  `npm run k6:full` and then stops the background server. The script also generates an HTML report
  and opens it in the default browser upon successful completion.

.EXAMPLE
  # Run against local server (default) and open report
  .\run-k6.ps1

  # Run against staging and custom stages (JSON)
  .\run-k6.ps1 -BaseUrl 'https://api-staging.example.com' -EnvStages '[{"duration":"1m","target":5},{"duration":"5m","target":20},{"duration":"1m","target":0}]'

  # Start server automatically, then run tests and open report
  .\run-k6.ps1 -StartServer

#>

Write-Host "Setting BASE_URL=$BaseUrl"
$env:BASE_URL = $BaseUrl

if ($EnvStages -ne '') {
  Write-Host "Setting ENV_STAGES to provided JSON"
  $env:ENV_STAGES = $EnvStages
} elseif ($StageTargets -ne '' -and $StageDurations -ne '') {
  Write-Host "Setting STAGE_TARGETS and STAGE_DURATIONS"
  $env:STAGE_TARGETS = $StageTargets
  $env:STAGE_DURATIONS = $StageDurations
} else {
  Write-Host "No custom stages provided — using defaults from k6/options.js"
}

Write-Host "Setting ENV_P95_MS=$P95Ms and ENV_ERROR_RATE=$ErrorRate"
$env:ENV_P95_MS = $P95Ms.ToString()
$env:ENV_ERROR_RATE = $ErrorRate.ToString()

$serverProc = $null
if ($StartServer) {
  Write-Host "Starting server: node app.js (will run in background)"
  $serverProc = Start-Process -FilePath 'node' -ArgumentList 'app.js' -PassThru
  Start-Sleep -Seconds 1
  Write-Host ("Server started (PID: {0}). Give it a few seconds to warm up if needed." -f $serverProc.Id)
}

try {
  Write-Host "Running: npm run k6:full"
  & npm run k6:full
  $code = $LASTEXITCODE
  if ($code -ne 0) {
    Write-Host "k6 run exited with code $code" -ForegroundColor Yellow
  } else {
    Write-Host "k6 run completed successfully" -ForegroundColor Green
    if (Test-Path -Path "test/k6/report.html") {
        Write-Host "HTML report generated at test/k6/report.html. Opening..."
        Invoke-Item -Path "test/k6/report.html"
    }
  }
} finally {
  if ($serverProc -ne $null) {
    try {
      Write-Host ('Stopping server (PID: ' + $serverProc.Id + ')')
      Stop-Process -Id $serverProc.Id -Force -ErrorAction Stop
      Write-Host "Server stopped"
    } catch {
      Write-Host ('Failed to stop server process: ' + $_.Exception.Message) -ForegroundColor Yellow
    }
  }
}