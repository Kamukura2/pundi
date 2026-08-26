[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param()
$ErrorActionPreference = 'Stop'
$TaskName = 'Pundi Admin Smoke Health'
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing -and $PSCmdlet.ShouldProcess($TaskName, 'Unregister scheduled task')) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Output "Removed $TaskName"
} elseif (-not $existing) { Write-Output "Task not found: $TaskName" }
