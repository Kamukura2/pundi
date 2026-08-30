[CmdletBinding()]
param(
    [switch]$WriteOperation,
    [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
    [string[]]$SupabaseArgs
)

$ErrorActionPreference = 'Stop'
$Repo = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$SecretFile = Join-Path $Repo '.env.supabase-pundi.local'
$ExpectedRef = 'ndeycwoyjwyntjkgbzlz'
$ExpectedName = 'Pundi'
$ForbiddenRef = 'zewnnzorrjtkhkuxfiou'

function Stop-Safe([string]$Message) {
    Write-Error ('PUNDI_SUPABASE_ABORT: ' + $Message)
    exit 2
}

if (-not (Test-Path -LiteralPath $SecretFile -PathType Leaf)) {
    Stop-Safe 'Pundi secret file is missing.'
}

& git -C $Repo check-ignore -q -- $SecretFile
if ($LASTEXITCODE -ne 0) {
    Stop-Safe 'Pundi secret file is not Git-ignored.'
}

$secretLines = Get-Content -LiteralPath $SecretFile
$tokenLine = $secretLines | Where-Object { $_ -match '^SUPABASE_ACCESS_TOKEN=' } | Select-Object -First 1
$passwordLine = $secretLines | Where-Object { $_ -match '^SUPABASE_DB_PASSWORD=' } | Select-Object -First 1
if (-not $tokenLine -or $tokenLine -notmatch '^SUPABASE_ACCESS_TOKEN=(.+)$') {
    Stop-Safe 'Pundi access token is missing.'
}
$token = $Matches[1].Trim()
if ([string]::IsNullOrWhiteSpace($token)) {
    Stop-Safe 'Pundi access token is empty.'
}
if (-not $passwordLine -or $passwordLine -notmatch '^SUPABASE_DB_PASSWORD=(.+)$') {
    Stop-Safe 'Pundi database password is missing.'
}
$dbPassword = $Matches[1].Trim()
if ([string]::IsNullOrWhiteSpace($dbPassword)) {
    Stop-Safe 'Pundi database password is empty.'
}

$argText = ($SupabaseArgs -join ' ')
if ($argText -match [regex]::Escape($token) -or $argText -match [regex]::Escape($dbPassword) -or $argText -match 'SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)=') {
    Stop-Safe 'Secret material was supplied as a command argument.'
}
if ($argText -match [regex]::Escape($ForbiddenRef)) {
    Stop-Safe 'Nook target is forbidden.'
}
if ($WriteOperation -and $argText -notmatch [regex]::Escape($ExpectedRef)) {
    Stop-Safe 'Write operation must name the exact Pundi ref.'
}

$oldToken = $env:SUPABASE_ACCESS_TOKEN
$hadOldToken = $null -ne $oldToken
$oldDbPassword = $env:SUPABASE_DB_PASSWORD
$hadOldDbPassword = $null -ne $oldDbPassword
try {
    $env:SUPABASE_ACCESS_TOKEN = $token
    $env:SUPABASE_DB_PASSWORD = $dbPassword

    $listing = & npx.cmd supabase projects list --output-format json 2>$null
    if ($LASTEXITCODE -ne 0) {
        Stop-Safe 'Pundi project verification failed.'
    }
    try { $projects = ($listing -join "`n") | ConvertFrom-Json } catch {
        Stop-Safe 'Pundi project listing was not valid JSON.'
    }
    $match = @($projects.projects | Where-Object { $_.name -eq $ExpectedName -and $_.ref -eq $ExpectedRef })
    if ($match.Count -ne 1) {
        Stop-Safe 'Exact Pundi project/ref was not uniquely verified.'
    }

    if (($SupabaseArgs -join ' ') -match '(^|\s)link(\s|$)') {
        if ($argText -notmatch [regex]::Escape($ExpectedRef)) {
            Stop-Safe 'Link operation must target exact Pundi ref.'
        }
    }

    & npx.cmd supabase @SupabaseArgs
    $exitCode = $LASTEXITCODE
}
finally {
    if ($hadOldToken) { $env:SUPABASE_ACCESS_TOKEN = $oldToken }
    else { Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue }
    if ($hadOldDbPassword) { $env:SUPABASE_DB_PASSWORD = $oldDbPassword }
    else { Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue }
    $token = $null
    $dbPassword = $null
}
exit $exitCode
