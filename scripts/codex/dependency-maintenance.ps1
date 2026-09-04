[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$AuthorizationFile,

    [string]$WorktreeRoot = (Get-Location).Path,

    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

$resolvedAuthorization = [IO.Path]::GetFullPath($AuthorizationFile)
$hint = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$currentRoot = (& git -C $hint rev-parse --show-toplevel).Trim()
$currentRoot = [IO.Path]::GetFullPath($currentRoot)
$commonRaw = (& git -C $currentRoot rev-parse --git-common-dir).Trim()
$commonDirectory = if ([IO.Path]::IsPathRooted($commonRaw)) { [IO.Path]::GetFullPath($commonRaw) } else { [IO.Path]::GetFullPath((Join-Path $currentRoot $commonRaw)) }
$canonicalProjectHome = [IO.Path]::GetFullPath([IO.Path]::GetDirectoryName($commonDirectory)).TrimEnd('\')
$authorizationRoot = [IO.Path]::GetFullPath((Join-Path $canonicalProjectHome 'runtime/codex/dependency-maintenance-authorizations')).TrimEnd('\')
if (-not $resolvedAuthorization.Equals($authorizationRoot, [StringComparison]::OrdinalIgnoreCase) -and
    -not $resolvedAuthorization.StartsWith("$authorizationRoot\", [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The authorization record must be inside the project-local runtime/codex directory.'
}
if (-not (Test-Path -LiteralPath $resolvedAuthorization -PathType Leaf)) {
    throw 'A user-created single-use authorization record is required.'
}

$coreScript = Join-Path $PSScriptRoot 'ensure-worktree-deps.ps1'
$arguments = @(
    '-Mode',
    'DependencyMaintenance',
    '-WorktreeRoot',
    [IO.Path]::GetFullPath($WorktreeRoot),
    '-AuthorizationFile',
    $resolvedAuthorization
)
if ($Json) { $arguments += '-Json' }

& $coreScript @arguments
exit $LASTEXITCODE
