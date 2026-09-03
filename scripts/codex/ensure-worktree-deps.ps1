[CmdletBinding()]
param(
  [string]$WorktreeRoot = (Get-Location).Path,
  [switch]$CheckOnly,
  [switch]$AdoptHealthyExisting,
  [switch]$Json
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

$coreScript = Join-Path $PSScriptRoot 'worktree-deps-core.mjs'
$arguments = @($coreScript, '--worktree', [IO.Path]::GetFullPath($WorktreeRoot))
if ($CheckOnly) { $arguments += '--check-only' }
if ($AdoptHealthyExisting) { $arguments += '--adopt-healthy-existing' }
if ($Json) { $arguments += '--json' }

& node @arguments
