[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Repo = 'C:\JensenBot\Pundi'
$EnvFile = Join-Path $Repo '.env.admin-smoke.local'
$UserEnvFile = Join-Path $Repo '.env.user-smoke.local'
$HealthDir = Join-Path $Repo 'runtime\admin-smoke-health'
$LatestFile = Join-Path $HealthDir 'latest.json'
$LogDir = Join-Path $HealthDir 'logs'
$Started = Get-Date
$timestamp = $Started.ToUniversalTime().ToString('o')

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Sanitize([string]$Text) {
  if ($null -eq $Text) { return '' }
  $safe = $Text
  $safe = [regex]::Replace($safe, '(?im)(authorization\s*[:=]\s*bearer\s+)[^\s,;]+', '$1[REDACTED]')
  $safe = [regex]::Replace($safe, '(?im)(password|access[_-]?token|refresh[_-]?token|service[_-]?role[_-]?key|anon[_-]?key|api[_-]?key|secret)\s*[:=]\s*[^\s,;]+', '$1=[REDACTED]')
  $safe = [regex]::Replace($safe, '(?im)eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[REDACTED_TOKEN]')
  return $safe
}

$smokeExitCode = 1
$healthStatus = 'FAIL'
$output = ''
try {
  if (-not (Test-Path -LiteralPath $EnvFile)) { throw 'Smoke credential file is missing.' }
  if (-not (Test-Path -LiteralPath $UserEnvFile)) { throw 'Normal-user smoke credential file is missing.' }
  $envLines = @(Get-Content -LiteralPath $EnvFile -ErrorAction Stop) + @(Get-Content -LiteralPath $UserEnvFile -ErrorAction Stop)
  foreach ($line in $envLines) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$') {
      [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
    }
  }
  if ([string]::IsNullOrWhiteSpace($env:PUNDI_ADMIN_SMOKE_EMAIL) -or [string]::IsNullOrWhiteSpace($env:PUNDI_ADMIN_SMOKE_PASSWORD) -or [string]::IsNullOrWhiteSpace($env:PUNDI_USER_SMOKE_EMAIL) -or [string]::IsNullOrWhiteSpace($env:PUNDI_USER_SMOKE_PASSWORD)) { throw 'Smoke credential variables are missing.' }

  $env:PUNDI_EXPECTED_BUILD = (& git -C $Repo rev-parse --short=7 HEAD).Trim()
  $env:USERPROFILE = 'C:\Users\delly'
  $env:HOME = $env:USERPROFILE
  $env:APPDATA = Join-Path $env:USERPROFILE 'AppData\Roaming'
  $env:LOCALAPPDATA = Join-Path $env:USERPROFILE 'AppData\Local'
  $env:TEMP = Join-Path $env:LOCALAPPDATA 'Temp'
  $env:TMP = $env:TEMP
  $env:NODE_OPTIONS = '--dns-result-order=ipv4first'
  $nodeDir = 'C:\Program Files\nodejs'
  if (Test-Path (Join-Path $nodeDir 'npm.cmd')) { $env:PATH = "$nodeDir;$env:PATH" }
  $stdoutFile = Join-Path $HealthDir (".stdout-{0}.tmp" -f [guid]::NewGuid())
  $stderrFile = Join-Path $HealthDir (".stderr-{0}.tmp" -f [guid]::NewGuid())
  try {
    $process = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','test:production') -WorkingDirectory $Repo -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
    if (-not $process.WaitForExit(300000)) {
      $partialOutput = ((Get-Content -LiteralPath $stdoutFile -Raw -ErrorAction SilentlyContinue), (Get-Content -LiteralPath $stderrFile -Raw -ErrorAction SilentlyContinue) -join "`n")
      & taskkill.exe /PID $process.Id /T /F | Out-Null
      $process.WaitForExit()
      $smokeExitCode = 124
      $output = "Production smoke timed out after 300 seconds.`n$partialOutput"
    } else {
      $process.Refresh()
      $smokeExitCode = [int]$process.ExitCode
      $output = ((Get-Content -LiteralPath $stdoutFile -Raw -ErrorAction SilentlyContinue), (Get-Content -LiteralPath $stderrFile -Raw -ErrorAction SilentlyContinue) -join "`n")
    }
  } finally {
    Remove-Item -LiteralPath $stdoutFile,$stderrFile -Force -ErrorAction SilentlyContinue
  }
  if ($smokeExitCode -eq 0) { $healthStatus = 'PASS' }
} catch {
  $output = $_.Exception.Message
  $smokeExitCode = 1
}

$finished = Get-Date
$duration = [math]::Round(($finished - $Started).TotalSeconds, 3)
$runLog = Join-Path $LogDir ("run-{0}.log" -f $Started.ToUniversalTime().ToString('yyyyMMdd-HHmmss'))
$sanitized = Sanitize $output
@("timestamp=$timestamp", "status=$healthStatus", "exit_code=$smokeExitCode", "duration_seconds=$duration", "target=https://app.pundi.online", "supabase_ref=ndeycwoyjwyntjkgbzlz", '', $sanitized.Trim()) | Set-Content -LiteralPath $runLog -Encoding UTF8

$version = ((Get-Content -LiteralPath (Join-Path $Repo 'package.json') -Raw | ConvertFrom-Json).version)
$latest = [ordered]@{
  timestamp = $timestamp
  status = $healthStatus
  exit_code = [int]$smokeExitCode
  duration_seconds = $duration
  target = 'https://app.pundi.online'
  version = $version
  supabase_ref = 'ndeycwoyjwyntjkgbzlz'
}
$latest | ConvertTo-Json | Set-Content -LiteralPath $LatestFile -Encoding UTF8

Get-ChildItem -LiteralPath $LogDir -File -Filter 'run-*.log' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force -ErrorAction SilentlyContinue
exit $smokeExitCode
