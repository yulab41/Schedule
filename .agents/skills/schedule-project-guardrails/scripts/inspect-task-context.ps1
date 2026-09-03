[CmdletBinding()]
param(
    [string]$RepoRoot,
    [ValidateSet('L0', 'L1', 'L2', 'L3', 'L4')]
    [string]$Level = 'L1',
    [string]$TaskText = '',
    [string[]]$Paths = @(),
    [switch]$CurrentMessageAuthorizesProduction
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

function Assert-ScheduleRepository {
    param([string]$Root)

    $gitRoot = Invoke-GitRead -Arguments @('rev-parse', '--show-toplevel') -WorkingDirectory $Root
    $resolvedGitRoot = [System.IO.Path]::GetFullPath($gitRoot.Output.Trim())
    if (-not $resolvedGitRoot.Equals($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'the supplied path is not the Schedule repository root'
    }

    $required = @(
        'AGENTS.md',
        'package.json',
        'pnpm-workspace.yaml',
        'docs/project-status.md',
        'docs/agent-context/pitfall-index.json',
        'scripts/prepare-release-worktree.mjs',
        'apps/miniprogram/AGENTS.md'
    )
    foreach ($relativePath in $required) {
        if (-not (Test-Path -LiteralPath (Join-Path $Root $relativePath) -PathType Leaf)) {
            throw "missing Schedule marker: $relativePath"
        }
    }

    $package = Get-Content -LiteralPath (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json
    if ($package.name -ne 'medical-staff-scheduling-system' -or $package.private -ne $true) {
        throw 'package.json does not identify the private Schedule repository'
    }
}

function Get-SkillHash {
    param([string]$SkillRoot)

    $lines = foreach ($file in Get-ChildItem -LiteralPath $SkillRoot -File -Recurse | Sort-Object FullName) {
        $relativePath = ($file.FullName.Substring($SkillRoot.Length) -replace '^[\\/]+', '') -replace '\\', '/'
        $fileHash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        "$relativePath=$fileHash"
    }
    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        -join ($algorithm.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
    }
    finally {
        $algorithm.Dispose()
    }
}

function Add-Unique {
    param(
        [System.Collections.Generic.List[string]]$List,
        [string]$Value
    )

    if (-not $List.Contains($Value)) {
        $List.Add($Value)
    }
}

try {
    if ($Level -eq 'L4' -and -not $CurrentMessageAuthorizesProduction) {
        throw 'L4 requires -CurrentMessageAuthorizesProduction after explicit authorization in the current user message'
    }
    if ($Level -ne 'L4' -and $CurrentMessageAuthorizesProduction) {
        throw '-CurrentMessageAuthorizesProduction is valid only with L4'
    }

    $root = Resolve-RepositoryRoot
    Assert-ScheduleRepository -Root $root

    $expectedSkillRoot = [System.IO.Path]::GetFullPath(
        (Join-Path $root '.agents/skills/schedule-project-guardrails')
    )
    $actualSkillRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
    if (-not $actualSkillRoot.Equals($expectedSkillRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'the skill is not installed at the Schedule repository-local path'
    }

    $normalizedPaths = @($Paths | Where-Object { $_ } | ForEach-Object { $_ -replace '\\', '/' })
    $haystack = (($TaskText, ($normalizedPaths -join ' ')) -join ' ').ToLowerInvariant()
    $isMiniProgram = $haystack -match 'miniprogram|mini program|\u5c0f\u7a0b\u5e8f|\u5fae\u4fe1|apps/miniprogram'
    $isVisibleUi = $haystack -match 'visible ui|visual|interaction|layout|storybook|\bui\b|\bux\b|\u754c\u9762|\u89c6\u89c9|\u4ea4\u4e92|\u5e03\u5c40'
    $isUnknownDebug = $haystack -match 'unknown root|unknown cause|root cause unknown|\u672a\u77e5\u6839\u56e0|\u539f\u56e0\u4e0d\u660e|\u65e0\u6cd5\u590d\u73b0'
    $isAmbiguous = $haystack -match 'ambiguous|unclear requirement|architecture undecided|\u9700\u6c42\u4e0d\u660e|\u67b6\u6784\u672a\u5b9a|\u4ecd\u6709\u6b67\u4e49'
    $hasApprovedDesign = $haystack -match 'approved design|design approved|\u5df2\u6279\u51c6.*\u8bbe\u8ba1|\u8bbe\u8ba1.*\u5df2\u6279\u51c6|\u5b8c\u6574\u8bbe\u8ba1'
    $needsWorktree = $Level -in @('L3', 'L4') -or
        $haystack -match 'worktree|bootstrap|dependency|install|build|dist|declaration|\u5de5\u4f5c\u6811|\u4f9d\u8d56|\u5b89\u88c5|\u6784\u5efa|\u58f0\u660e'
    $needsDebugging = $isUnknownDebug -or $haystack -match 'regression|debug|failure|error|\u56de\u5f52|\u6545\u969c|\u5931\u8d25|\u62a5\u9519'

    $applicableAgents = [System.Collections.Generic.List[string]]::new()
    Add-Unique -List $applicableAgents -Value 'AGENTS.md'
    if ($isMiniProgram) {
        Add-Unique -List $applicableAgents -Value 'apps/miniprogram/AGENTS.md'
    }

    $references = [System.Collections.Generic.List[string]]::new()
    Add-Unique -List $references -Value 'references/task-levels.md'
    if ($Level -ne 'L0') {
        Add-Unique -List $references -Value 'references/testing-and-evidence.md'
    }
    if ($needsWorktree) {
        Add-Unique -List $references -Value 'references/worktree-and-bootstrap.md'
    }
    if ($isMiniProgram) {
        Add-Unique -List $references -Value 'references/miniprogram.md'
    }
    if ($needsDebugging) {
        Add-Unique -List $references -Value 'references/debugging.md'
    }
    if ($Level -in @('L3', 'L4')) {
        Add-Unique -List $references -Value 'references/release-candidate.md'
    }
    if ($Level -eq 'L4') {
        Add-Unique -List $references -Value 'references/production.md'
    }

    $pitfallIndex = Get-Content -LiteralPath (Join-Path $root 'docs/agent-context/pitfall-index.json') -Raw |
        ConvertFrom-Json
    $matchedPitfalls = [System.Collections.Generic.List[string]]::new()
    foreach ($entry in $pitfallIndex.pitfalls) {
        $matched = $false
        foreach ($signal in $entry.signals) {
            if ($haystack.Contains($signal.ToString().ToLowerInvariant())) {
                $matched = $true
                break
            }
        }
        if (-not $matched) {
            foreach ($candidatePath in $normalizedPaths) {
                foreach ($pattern in $entry.paths) {
                    $likePattern = ($pattern.ToString() -replace '\\', '/') -replace '\*\*', '*'
                    if ($candidatePath -like $likePattern) {
                        $matched = $true
                        break
                    }
                }
                if ($matched) { break }
            }
        }
        if ($matched) {
            Add-Unique -List $matchedPitfalls -Value $entry.id
        }
    }
    if ($matchedPitfalls.Count -gt 0 -or
        $haystack -match 'enametoolong|version=local|198\.18\.|tun|banner|stdin|1459|fingerprint|patch|\u7a7a\u6708|\u5305\u4f53') {
        Add-Unique -List $references -Value 'references/known-pitfalls.md'
    }

    $optionalSkills = [System.Collections.Generic.List[string]]::new()
    if ($isMiniProgram) { Add-Unique -List $optionalSkills -Value '$miniprogram-development' }
    if ($isVisibleUi) { Add-Unique -List $optionalSkills -Value '$frontend-design' }
    if ($isUnknownDebug) { Add-Unique -List $optionalSkills -Value '$systematic-debugging' }
    if ($isAmbiguous -and -not $hasApprovedDesign) {
        Add-Unique -List $optionalSkills -Value '$brainstorming'
    }

    $status = Invoke-GitRead -Arguments @('status', '--porcelain=v1', '--untracked-files=normal') -WorkingDirectory $root
    $statusLines = @($status.Output -split '\r?\n' | Where-Object { $_ })
    $untrackedCount = @($statusLines | Where-Object { $_.StartsWith('??') }).Count
    $trackedCount = $statusLines.Count - $untrackedCount

    Write-Output 'PROJECT=Schedule'
    Write-Output "ROOT=$root"
    Write-Output "LEVEL=$Level"
    Write-Output "SKILL_HASH=$(Get-SkillHash -SkillRoot $actualSkillRoot)"
    Write-Output 'BASE_CONTEXT=docs/project-status.md;docs/agent-context/pitfall-index.json'
    Write-Output "APPLICABLE_AGENTS=$($applicableAgents -join ';')"
    Write-Output "REFERENCES=$($references -join ';')"
    Write-Output "MATCHED_PITFALLS=$($matchedPitfalls -join ';')"
    Write-Output "OPTIONAL_SKILLS=$($optionalSkills -join ';')"
    Write-Output "WORKTREE_STATUS=tracked:$trackedCount;untracked:$untrackedCount"
    Write-Output "PRODUCTION_AUTHORIZATION=$(if ($Level -eq 'L4') { 'asserted-current-message' } else { 'not-granted' })"
    Write-Output 'RESULT=PASS'
}
catch {
    [Console]::Error.WriteLine("[schedule-context] RESULT=FAIL; $($_.Exception.Message)")
    exit 2
}
