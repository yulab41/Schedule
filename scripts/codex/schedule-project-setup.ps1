[CmdletBinding()]
param(
    [string]$WorktreeRoot = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

function Get-GitValue {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    $value = (& git -C $WorkingDirectory @Arguments).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($value)) {
        throw "git $($Arguments -join ' ') failed for $WorkingDirectory"
    }
    return $value
}

function Get-CanonicalPath {
    param([Parameter(Mandatory = $true)][string]$Value)
    return [IO.Path]::GetFullPath($Value).TrimEnd('\').ToLowerInvariant()
}

function Test-PathInside {
    param(
        [Parameter(Mandatory = $true)][string]$Parent,
        [Parameter(Mandatory = $true)][string]$Child
    )
    $parentPath = Get-CanonicalPath $Parent
    $childPath = Get-CanonicalPath $Child
    return $childPath -eq $parentPath -or $childPath.StartsWith("$parentPath\", [StringComparison]::OrdinalIgnoreCase)
}

try {
    $current = [IO.Path]::GetFullPath($WorktreeRoot)
    $worktree = [IO.Path]::GetFullPath((Get-GitValue -WorkingDirectory $current -Arguments @('rev-parse', '--show-toplevel')))
    $commonRaw = Get-GitValue -WorkingDirectory $worktree -Arguments @('rev-parse', '--git-common-dir')
    $common = if ([IO.Path]::IsPathRooted($commonRaw)) {
        [IO.Path]::GetFullPath($commonRaw)
    } else {
        [IO.Path]::GetFullPath((Join-Path $worktree $commonRaw))
    }
    $canonicalHome = [IO.Path]::GetFullPath([IO.Path]::GetDirectoryName($common)).TrimEnd('\')
    $poolRoot = [IO.Path]::GetFullPath((Join-Path $canonicalHome 'runtime/wt')).TrimEnd('\')
    $rootAgents = Join-Path $worktree 'AGENTS.md'
    $overlayAgents = Join-Path $worktree 'AGENTS.override.md'
    $loadedAgents = @()
    foreach ($candidate in @($rootAgents, $overlayAgents)) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $content = Get-Content -LiteralPath $candidate -Raw
            if ($content.Contains('DEPENDENCY_MODE=REUSE_ONLY')) { $loadedAgents += $candidate }
        }
    }
    if ($loadedAgents.Count -eq 0) { throw 'Schedule AGENTS route was not found in the current worktree.' }

    Write-Output 'SETUP_MODE=REUSE_ONLY'
    Write-Output "CURRENT_WORKTREE=$worktree"
    Write-Output "CANONICAL_PROJECT_HOME=$canonicalHome"
    Write-Output "AGENTS_LOADED=true"
    Write-Output 'DEPENDENCY_MODE=REUSE_ONLY'
    Write-Output 'INSTALL_INVOKED=false'
    Write-Output 'WORKTREE_CREATED=false'

    $canonical = (Get-CanonicalPath $worktree) -eq (Get-CanonicalPath $canonicalHome)
    $poolSlot = $false
    if ((Test-Path -LiteralPath $poolRoot -PathType Container) -and (Test-PathInside -Parent $poolRoot -Child $worktree)) {
        $poolSlot = [IO.Path]::GetDirectoryName((Get-CanonicalPath $worktree)).TrimEnd('\') -eq (Get-CanonicalPath $poolRoot)
    }

    if ($canonical) {
        Write-Output 'TASK_STATUS=CANONICAL_ROOT_READY'
        Write-Output 'USE_CANONICAL_PROJECT_POOL=true'
        Write-Output 'DEPENDENCIES_REUSED=false'
        exit 0
    }

    if (-not $poolSlot) {
        Write-Output 'TASK_STATUS=MANAGED_WORKTREE_NOT_WARM'
        Write-Output 'USE_CANONICAL_PROJECT_POOL=true'
        Write-Output 'DEPENDENCIES_REUSED=false'
        exit 0
    }

    $leaseRoot = Join-Path $canonicalHome 'runtime/codex/leases'
    $lease = $null
    if (Test-Path -LiteralPath $leaseRoot -PathType Container) {
        foreach ($file in @(Get-ChildItem -LiteralPath $leaseRoot -File -Filter '*.json')) {
            try {
                $candidate = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
                if ((Get-CanonicalPath ([string]$candidate.path)) -eq (Get-CanonicalPath $worktree)) {
                    $lease = $candidate
                    break
                }
            } catch { }
        }
    }

    if (-not $lease) {
        Write-Output 'TASK_STATUS=POOL_SLOT_FREE'
        Write-Output 'USE_CANONICAL_PROJECT_POOL=false'
        Write-Output 'DEPENDENCIES_REUSED=false'
        Write-Output 'LEASE_PRESENT=false'
        exit 0
    }

    $dependencyScript = Join-Path $PSScriptRoot 'ensure-worktree-deps.ps1'
    $dependencyOutput = & $dependencyScript -Mode ReuseOnly -WorktreeRoot $worktree -LeaseToken ([string]$lease.token) -Json
    $dependency = (($dependencyOutput -join [Environment]::NewLine) | ConvertFrom-Json)
    Write-Output "TASK_STATUS=$($dependency.taskStatus)"
    Write-Output 'USE_CANONICAL_PROJECT_POOL=false'
    Write-Output "LEASE_PRESENT=true"
    $reused = ([bool]$dependency.dependenciesReused).ToString().ToLowerInvariant()
    Write-Output "DEPENDENCIES_REUSED=$reused"
    foreach ($reason in @($dependency.reasons)) { Write-Output "INVALIDATION_REASON=$reason" }
}
catch {
    Write-Error $_
    exit 2
}
