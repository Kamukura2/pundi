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

$exitCode = 1
$status = 'FAIL'
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

  $env:PUNDI_EXPECTED_BUILD = 'c22360c'
  $stdoutFile = Join-Path $HealthDir (".stdout-{0}.tmp" -f [guid]::NewGuid())
  $stderrFile = Join-Path $HealthDir (".stderr-{0}.tmp" -f [guid]::NewGuid())
  try {
    $process = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','test:production') -WorkingDirectory $Repo -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
    $exitCode = $process.ExitCode
    $output = ((Get-Content -LiteralPath $stdoutFile -Raw -ErrorAction SilentlyContinue), (Get-Content -LiteralPath $stderrFile -Raw -ErrorAction SilentlyContinue) -join "`n")
  } finally {
    Remove-Item -LiteralPath $stdoutFile,$stderrFile -Force -ErrorAction SilentlyContinue
  }
  if ($exitCode -eq 0) { $status = 'PASS' }
} catch {
  $output = $_.Exception.Message
  $exitCode = 1
}

$finished = Get-Date
$duration = [math]::Round(($finished - $Started).TotalSeconds, 3)
$runLog = Join-Path $LogDir ("run-{0}.log" -f $Started.ToUniversalTime().ToString('yyyyMMdd-HHmmss'))
$sanitized = Sanitize $output
@("timestamp=$timestamp", "status=$status", "exit_code=$exitCode", "duration_seconds=$duration", "target=https://pundi-silk.vercel.app", "supabase_ref=ndeycwoyjwyntjkgbzlz", '', $sanitized.Trim()) | Set-Content -LiteralPath $runLog -Encoding UTF8

$latest = [ordered]@{
  timestamp = $timestamp
  status = $status
  exit_code = [int]$exitCode
  duration_seconds = $duration
  target = 'https://pundi-silk.vercel.app'
  supabase_ref = 'ndeycwoyjwyntjkgbzlz'
}
$latest | ConvertTo-Json | Set-Content -LiteralPath $LatestFile -Encoding UTF8

Get-ChildItem -LiteralPath $LogDir -File -Filter 'run-*.log' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force -ErrorAction SilentlyContinue
exit $exitCode
