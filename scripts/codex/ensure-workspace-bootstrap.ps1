[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('mini', 'api', 'web', 'root-typecheck', 'release')]
  [string]$Profile,

  [string]$WorktreeRoot = (Get-Location).Path,

  [switch]$Json
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

$coreScript = Join-Path $PSScriptRoot 'workspace-bootstrap-core.mjs'
$arguments = @(
  $coreScript,
  '--worktree',
  [IO.Path]::GetFullPath($WorktreeRoot),
  '--profile',
  $Profile
)
if ($Json) { $arguments += '--json' }

& node @arguments
