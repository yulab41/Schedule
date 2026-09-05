[CmdletBinding()]
param(
    [ValidateSet('ReuseOnly', 'DependencyMaintenance')]
    [string]$Mode = 'ReuseOnly',

    [string]$WorktreeRoot = (Get-Location).Path,

    [string]$AuthorizationFile,

    [string]$LeaseToken,
    [string]$Owner,
    [string]$SessionId,
    [string]$TaskId,
    [string]$SlotId,
    [string]$BaseSha,
    [string]$Fingerprint,

    [switch]$AdoptHealthyExisting,

    [switch]$CurrentMessageAuthorization,

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
foreach ($binding in @{ Owner='--owner'; SessionId='--session-id'; TaskId='--task-id'; SlotId='--slot-id'; BaseSha='--base-sha'; Fingerprint='--fingerprint' }.GetEnumerator()) {
    $value = Get-Variable -Name $binding.Key -ValueOnly
    if ($value) { $arguments += @($binding.Value, $value) }
}
if ($AdoptHealthyExisting) { $arguments += '--adopt-healthy-existing' }
if ($CurrentMessageAuthorization) { $arguments += '--current-message-authorization' }
if ($Json) { $arguments += '--json' }

& node @arguments
exit $LASTEXITCODE
