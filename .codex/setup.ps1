[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

$setup = Join-Path $PSScriptRoot '../scripts/codex/schedule-project-setup.ps1'
& $setup
exit $LASTEXITCODE
