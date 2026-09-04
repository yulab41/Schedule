[CmdletBinding()]
param(
    [ValidateSet('ReuseOnly', 'DependencyMaintenance')]
    [string]$Mode = 'ReuseOnly',

    [string]$WorktreeRoot = (Get-Location).Path,

    [string]$AuthorizationFile,

    [string]$LeaseToken,

    [switch]$AdoptHealthyExisting,

    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

$coreScript = Join-Path $PSScriptRoot 'worktree-deps-core.mjs'
$arguments = @(
    $coreScript,
    '--mode',
    $Mode,
    '--worktree',
    [IO.Path]::GetFullPath($WorktreeRoot)
)
if ($AuthorizationFile) { $arguments += @('--authorization-file', [IO.Path]::GetFullPath($AuthorizationFile)) }
if ($LeaseToken) { $arguments += @('--lease-token', $LeaseToken) }
if ($AdoptHealthyExisting) { $arguments += '--adopt-healthy-existing' }
if ($Json) { $arguments += '--json' }

& node @arguments
exit $LASTEXITCODE
