[CmdletBinding()]
param(
    [string]$RepoRoot,
    [string]$WorktreePath,
    [string]$ExpectedCommit,
    [switch]$RequireReady,
    [switch]$ForMiniprogramUpload,
    [string]$MiniProgramVersion
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

function Invoke-GitRead {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,
        [int[]]$AllowedExitCodes = @(0)
    )

    $preference = Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
    $raw = @()
    $exitCode = -1
    try {
        $PSNativeCommandUseErrorActionPreference = $false
        Push-Location -LiteralPath $WorkingDirectory
        try {
            $raw = @(& git @Arguments 2>&1)
            $exitCode = $LASTEXITCODE
        }
        finally {
            Pop-Location
        }
    }
    finally {
        if ($null -ne $preference) {
            $PSNativeCommandUseErrorActionPreference = $preference.Value
        }
        else {
            Remove-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Local -ErrorAction SilentlyContinue
        }
    }

    if ($AllowedExitCodes -notcontains $exitCode) {
        $detail = ($raw | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
        throw "git $($Arguments -join ' ') failed with exit code $exitCode$(if ($detail) { ": $detail" })"
    }

    [pscustomobject]@{
        ExitCode = $exitCode
        Output = (($raw | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine).TrimEnd()
    }
}

function Resolve-RepositoryRoot {
    if ($RepoRoot) {
        return [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $RepoRoot).Path)
    }
    $result = Invoke-GitRead -Arguments @('rev-parse', '--show-toplevel') -WorkingDirectory (Get-Location).Path
    [System.IO.Path]::GetFullPath($result.Output.Trim())
}

function Assert-NoReparsePoint {
    param(
        [string]$Root,
        [string]$Candidate
    )

    $rootPrefix = $Root.TrimEnd([char[]]@('\', '/')) + [System.IO.Path]::DirectorySeparatorChar
    if (-not $Candidate.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'candidate path is outside the repository root'
    }
    $relative = $Candidate.Substring($rootPrefix.Length)
    $current = $Root
    foreach ($segment in $relative -split '[\\/]') {
        if (-not $segment -or $segment -eq '.') { continue }
        $current = Join-Path $current $segment
        if (-not (Test-Path -LiteralPath $current)) { break }
        $item = Get-Item -LiteralPath $current -Force
        if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "path crosses a reparse point: $current"
        }
    }
}

function Parse-WorktreeList {
    param([string]$Text)

    $records = @()
    $record = $null
    foreach ($line in $Text -split '\r?\n') {
        if ($line.StartsWith('worktree ')) {
            if ($null -ne $record) { $records += $record }
            $record = [ordered]@{
                Path = $line.Substring('worktree '.Length)
                Head = ''
                Detached = $false
                Branch = ''
            }
        }
        elseif ($null -ne $record -and $line.StartsWith('HEAD ')) {
            $record.Head = $line.Substring('HEAD '.Length)
        }
        elseif ($null -ne $record -and $line -eq 'detached') {
            $record.Detached = $true
        }
        elseif ($null -ne $record -and $line.StartsWith('branch ')) {
            $record.Branch = $line.Substring('branch '.Length)
        }
    }
    if ($null -ne $record) { $records += $record }
    @($records | ForEach-Object { [pscustomobject]$_ })
}

try {
    $root = Resolve-RepositoryRoot
    $packagePath = Join-Path $root 'package.json'
    $helperPath = Join-Path $root 'scripts/prepare-release-worktree.mjs'
    if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $helperPath -PathType Leaf)) {
        throw 'Schedule repository markers are missing'
    }
    $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
    if ($package.name -ne 'medical-staff-scheduling-system' -or $package.private -ne $true) {
        throw 'package.json does not identify the private Schedule repository'
    }

    $gitRoot = Invoke-GitRead -Arguments @('rev-parse', '--show-toplevel') -WorkingDirectory $root
    $resolvedGitRoot = [System.IO.Path]::GetFullPath($gitRoot.Output.Trim())
    if (-not $resolvedGitRoot.Equals($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'RepoRoot is not the Git top level'
    }

    $runtimeRoot = [System.IO.Path]::GetFullPath((Join-Path $root 'runtime'))
    $fixedPath = [System.IO.Path]::GetFullPath((Join-Path $runtimeRoot 'release-worktree'))
    $candidate = if ($WorktreePath) {
        [System.IO.Path]::GetFullPath($WorktreePath)
    }
    else {
        $fixedPath
    }
    if (-not $candidate.Equals($fixedPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "release worktree must use the fixed path: $fixedPath"
    }
    if ($candidate.Length -gt 120) {
        throw 'release worktree path is too long for the fixed Windows safety budget'
    }
    if (-not (Test-Path -LiteralPath $runtimeRoot -PathType Container)) {
        throw 'runtime directory is absent; use the existing release helper rather than creating paths manually'
    }
    Assert-NoReparsePoint -Root $root -Candidate $candidate

    $worktreeList = Invoke-GitRead -Arguments @('worktree', 'list', '--porcelain') -WorkingDirectory $root
    $records = Parse-WorktreeList -Text $worktreeList.Output
    $record = $records | Where-Object {
        [System.IO.Path]::GetFullPath($_.Path).Equals(
            $candidate,
            [System.StringComparison]::OrdinalIgnoreCase
        )
    } | Select-Object -First 1
    $pathExists = Test-Path -LiteralPath $candidate -PathType Container

    if ($pathExists -and $null -eq $record) {
        throw 'fixed path exists but is not a registered worktree; refusing to take it over'
    }
    if (-not $pathExists -and $null -ne $record) {
        throw 'Git registers the fixed worktree but its directory is missing; repair it manually'
    }
    if (-not $pathExists) {
        if ($RequireReady -or $ForMiniprogramUpload) {
            throw 'managed release worktree is not ready; use scripts/prepare-release-worktree.mjs'
        }
        Write-Output 'PROJECT=Schedule'
        Write-Output "WORKTREE=$candidate"
        Write-Output 'STATE=absent'
        Write-Output 'RESULT=PASS'
        exit 0
    }

    if (-not $record.Detached -or $record.Branch) {
        throw 'managed release worktree must be detached and must not own a branch'
    }

    $head = (Invoke-GitRead -Arguments @('rev-parse', 'HEAD') -WorkingDirectory $candidate).Output.Trim()
    if ($head -notmatch '^[0-9a-f]{40}$') {
        throw 'managed worktree HEAD is not a full commit SHA'
    }
    if ($ExpectedCommit) {
        $resolvedExpected = (
            Invoke-GitRead -Arguments @('rev-parse', "$ExpectedCommit^{commit}") -WorkingDirectory $root
        ).Output.Trim()
        if ($head -ne $resolvedExpected) {
            throw "managed worktree HEAD $head does not match expected commit $resolvedExpected"
        }
    }

    $worktreeDiff = Invoke-GitRead -Arguments @('diff', '--quiet', '--exit-code') `
        -WorkingDirectory $candidate -AllowedExitCodes @(0, 1)
    $indexDiff = Invoke-GitRead -Arguments @('diff', '--cached', '--quiet', '--exit-code') `
        -WorkingDirectory $candidate -AllowedExitCodes @(0, 1)
    $untracked = Invoke-GitRead -Arguments @('ls-files', '--others', '--exclude-standard') `
        -WorkingDirectory $candidate
    if ($worktreeDiff.ExitCode -eq 1 -or $indexDiff.ExitCode -eq 1 -or $untracked.Output) {
        throw 'managed release worktree contains tracked, staged, or untracked changes'
    }

    if ($ForMiniprogramUpload) {
        if (-not $RequireReady -or -not $ExpectedCommit) {
            throw 'Mini Program upload checks require -RequireReady and -ExpectedCommit'
        }
        $version = if ($MiniProgramVersion) { $MiniProgramVersion.Trim() } else { '' }
        $semanticVersion = '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$'
        if (-not $version -or $version -notmatch $semanticVersion -or $version -match '(?i)local') {
            throw 'Mini Program upload version must be explicit semantic version text and cannot contain local'
        }

        $profilePath = Join-Path $candidate 'apps/miniprogram/dist/build-profile.json'
        if (-not (Test-Path -LiteralPath $profilePath -PathType Leaf)) {
            throw 'Mini Program build-profile.json is missing from the candidate'
        }
        $profile = Get-Content -LiteralPath $profilePath -Raw | ConvertFrom-Json
        if ($profile.schemaVersion -ne 1 -or $profile.profile -ne 'production') {
            throw 'Mini Program candidate is not a schema v1 production-profile build'
        }
        if ($profile.buildVersion -ne $version -or $profile.buildVersion -match '(?i)local') {
            throw 'Mini Program build profile version does not match the explicit non-local upload version'
        }
        if ($profile.buildDirty -ne $false) {
            throw 'Mini Program build profile reports a dirty source tree'
        }
        $profileCommit = $profile.buildCommit.ToString()
        if ($profileCommit.Length -lt 7 -or -not $head.StartsWith($profileCommit)) {
            throw 'Mini Program build profile commit does not match the candidate HEAD'
        }

        $ignoredProfile = Invoke-GitRead -Arguments @(
            'check-ignore', '-q', '--no-index', 'apps/miniprogram/dist/build-profile.json'
        ) -WorkingDirectory $candidate -AllowedExitCodes @(0, 1)
        if ($ignoredProfile.ExitCode -ne 0) {
            throw 'Mini Program generated build profile is not ignored by Git'
        }
        Write-Output "MINIPROGRAM_VERSION=$version"
        Write-Output 'VERSION_LOCAL=absent'
        Write-Output 'MINIPROGRAM_PROFILE=production-clean'
    }

    Write-Output 'PROJECT=Schedule'
    Write-Output "WORKTREE=$candidate"
    Write-Output "HEAD=$head"
    Write-Output 'STATE=ready-clean-detached'
    Write-Output 'RESULT=PASS'
}
catch {
    [Console]::Error.WriteLine("[schedule-worktree] RESULT=FAIL; $($_.Exception.Message)")
    exit 2
}
