[CmdletBinding()]
param(
    [string]$RepoRoot,
    [string]$WorktreePath,
    [string]$ExpectedCommit,
    [string]$LeaseToken,
    [string]$RunId,
    [switch]$RequireReady,
    [switch]$ForMiniprogramUpload,
    [string]$MiniProgramVersion,
    [string]$OutputDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

try {
    if (-not $WorktreePath -or -not $ExpectedCommit -or -not $LeaseToken -or -not $RunId) {
        throw 'Candidate checks require WorktreePath, ExpectedCommit, LeaseToken and RunId from the owning Acquire.'
    }
    if ($ForMiniprogramUpload -and (-not $RequireReady -or -not $MiniProgramVersion)) {
        throw 'Upload checks require RequireReady and an explicit MiniProgramVersion.'
    }
    $scriptCheckout = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
    $core = Join-Path $scriptCheckout 'scripts/codex/release-candidate-core.mjs'
    if (-not (Test-Path -LiteralPath $core -PathType Leaf)) { throw 'Canonical candidate checker core is missing.' }
    $arguments = @($core, '--worktree', $WorktreePath, '--expected-commit', $ExpectedCommit,
        '--lease-token', $LeaseToken, '--run-id', $RunId)
    if ($RepoRoot) { $arguments += @('--repo', $RepoRoot) }
    if ($OutputDirectory) { $arguments += @('--output', $OutputDirectory) }
    if ($ForMiniprogramUpload) { $arguments += @('--for-upload', '--version', $MiniProgramVersion) }
    $output = & node @arguments
    if ($LASTEXITCODE -ne 0) { throw 'Candidate safety check failed; no source or external state was changed.' }
    $result = ($output -join [Environment]::NewLine) | ConvertFrom-Json
    if ($result.state -ne 'ready-clean-detached' -or -not $result.dependenciesReused -or $result.installInvoked) {
        throw 'Candidate checker returned an unexpected state.'
    }
    Write-Output 'PROJECT=Schedule'
    Write-Output "WORKTREE=$($result.worktree)"
    Write-Output "HEAD=$($result.head)"
    Write-Output "RUN_ID=$($result.runId)"
    Write-Output "PURPOSE=$($result.purpose)"
    Write-Output 'STATE=ready-clean-detached'
    if ($ForMiniprogramUpload) {
        Write-Output "MINIPROGRAM_VERSION=$($result.version)"
        Write-Output 'VERSION_LOCAL=absent'
        Write-Output 'MINIPROGRAM_PROFILE=production-clean'
    }
    Write-Output 'RESULT=PASS'
}
catch {
    [Console]::Error.WriteLine("[schedule-worktree] RESULT=FAIL; $($_.Exception.Message)")
    exit 2
}
