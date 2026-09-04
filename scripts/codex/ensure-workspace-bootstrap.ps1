[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('mini', 'api', 'web', 'root', 'release')]
    [string]$Profile,

    [ValidateSet('ReuseOnly')]
    [string]$Mode = 'ReuseOnly',

    [string]$WorktreeRoot = (Get-Location).Path,

    [string]$LeaseToken,

    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

$coreScript = Join-Path $PSScriptRoot 'workspace-bootstrap-core.mjs'
$arguments = @(
    $coreScript,
    '--profile',
    $Profile.ToLowerInvariant(),
    '--worktree',
    [IO.Path]::GetFullPath($WorktreeRoot)
)
if ($LeaseToken) { $arguments += @('--lease-token', $LeaseToken) }
if ($Json) { $arguments += '--json' }

& node @arguments
exit $LASTEXITCODE
