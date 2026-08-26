[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$TaskName = 'Pundi Admin Smoke Health'
$Repo = 'C:\JensenBot\Pundi'
$Latest = Join-Path $Repo 'runtime\admin-smoke-health\latest.json'
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$info = if ($task) { Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue }
Write-Output ("task=" + ($(if ($task) { $task.TaskName } else { 'MISSING' })))
Write-Output ("enabled=" + ($(if ($task -and $task.State -eq 'Disabled') { 'NO' } elseif ($task) { 'YES' } else { 'NO' })))
if ($info) {
  Write-Output ("last_run=" + $info.LastRunTime.ToUniversalTime().ToString('o'))
  Write-Output ("last_result=" + $info.LastTaskResult)
  Write-Output ("next_run=" + $info.NextRunTime.ToUniversalTime().ToString('o'))
}
if (Test-Path -LiteralPath $Latest) {
  $latest = Get-Content -LiteralPath $Latest -Raw | ConvertFrom-Json
  Write-Output ("latest_status=" + $latest.status)
  Write-Output ("latest_timestamp=" + $latest.timestamp)
} else { Write-Output 'latest_status=MISSING' }
