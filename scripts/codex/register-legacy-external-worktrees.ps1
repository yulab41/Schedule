[CmdletBinding()]
param(
    [string]$RepoRoot
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

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

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory
    )
    $raw = @(& git -C $WorkingDirectory @Arguments)
    if ($LASTEXITCODE -ne 0) { throw "git $($Arguments -join ' ') failed" }
    return ($raw -join "`n").Trim()
}

function Parse-WorktreeList {
    param([Parameter(Mandatory = $true)][string]$Source)
    $entries = @()
    foreach ($block in ($Source -split "`n`n")) {
        if ([string]::IsNullOrWhiteSpace($block)) { continue }
        $lines = $block -split "`n"
        $pathLine = $lines | Where-Object { $_.StartsWith('worktree ') } | Select-Object -First 1
        $headLine = $lines | Where-Object { $_.StartsWith('HEAD ') } | Select-Object -First 1
        if (-not $pathLine -or -not $headLine) { continue }
        $branchLine = $lines | Where-Object { $_.StartsWith('branch ') } | Select-Object -First 1
        $entries += [pscustomobject]@{
            path = [IO.Path]::GetFullPath($pathLine.Substring(9))
            head = $headLine.Substring(5)
            branch = if ($branchLine) { $branchLine.Substring(7) } else { $null }
            detached = $lines -contains 'detached'
        }
    }
    return $entries
}

function Get-ProcessEvidence {
    param([Parameter(Mandatory = $true)][string]$WorktreePath)
    $target = (Get-CanonicalPath $WorktreePath).Replace('\', '/')
    try {
        $matches = @(Get-CimInstance Win32_Process | Where-Object {
                [int]$_.ProcessId -ne $PID -and
                ([string]$_.CommandLine).ToLowerInvariant().Replace('\', '/').Contains($target)
            })
        return [ordered]@{ known = $true; count = $matches.Count; method = 'commandline-path' }
    }
    catch {
        return [ordered]@{ known = $false; count = $null; method = 'process-query-failed' }
    }
}

function Get-WorktreeRecord {
    param([Parameter(Mandatory = $true)][object]$Entry)
    $clean = $false
    try {
        $status = Invoke-Git -Arguments @('status', '--porcelain=v1', '--untracked-files=all') -WorkingDirectory $Entry.path
        $clean = $status -eq ''
    }
    catch { $clean = $false }
    $modulesPath = Join-Path $Entry.path 'node_modules'
    $modulesExists = Test-Path -LiteralPath $modulesPath
    $reparse = $false
    if ($modulesExists) {
        try { $reparse = ((Get-Item -LiteralPath $modulesPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 } catch { $reparse = $true }
    }
    $process = Get-ProcessEvidence $Entry.path
    return [ordered]@{
        path = [IO.Path]::GetFullPath($Entry.path)
        head = $Entry.head
        branch = $Entry.branch
        detached = [bool]$Entry.detached
        clean = $clean
        nodeModules = [ordered]@{
            exists = $modulesExists
            marker = Test-Path -LiteralPath (Join-Path $modulesPath '.modules.yaml')
            reparsePoint = $reparse
        }
        processEvidence = $process
        possibleOccupied = $true
        classification = 'LEGACY_EXTERNAL_IN_USE'
        registeredAsProjectPoolSlot = $false
    }
}

try {
    $hint = if ($RepoRoot) { [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $RepoRoot).Path) } else { [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')) }
    $currentRoot = [IO.Path]::GetFullPath((Invoke-Git -Arguments @('rev-parse', '--show-toplevel') -WorkingDirectory $hint))
    $commonRaw = Invoke-Git -Arguments @('rev-parse', '--git-common-dir') -WorkingDirectory $currentRoot
    $commonDirectory = if ([IO.Path]::IsPathRooted($commonRaw)) { [IO.Path]::GetFullPath($commonRaw) } else { [IO.Path]::GetFullPath((Join-Path $currentRoot $commonRaw)) }
    $canonicalProjectHome = [IO.Path]::GetFullPath([IO.Path]::GetDirectoryName($commonDirectory)).TrimEnd('\')
    $entries = Parse-WorktreeList (Invoke-Git -Arguments @('worktree', 'list', '--porcelain') -WorkingDirectory $currentRoot)
    $external = @($entries | Where-Object { -not (Test-PathInside -Parent $canonicalProjectHome -Child $_.path) } | ForEach-Object { Get-WorktreeRecord $_ })
    $statePath = Join-Path $canonicalProjectHome 'runtime/codex/state/legacy-external-environments.json'
    [void](New-Item -ItemType Directory -Path (Split-Path -Parent $statePath) -Force)
    $temporaryPath = "$statePath.$PID.tmp"
    $payload = [ordered]@{
        schemaVersion = 1
        generatedAt = (Get-Date).ToUniversalTime().ToString('o')
        canonicalProjectHome = $canonicalProjectHome
        policy = 'read-only registration; external worktrees are never moved, cleaned, or pooled by this project-local manager'
        environments = $external
    }
    $encoding = [Text.UTF8Encoding]::new($false)
    [IO.File]::WriteAllText($temporaryPath, (($payload | ConvertTo-Json -Depth 12) + "`n"), $encoding)
    Move-Item -LiteralPath $temporaryPath -Destination $statePath -Force
    Write-Output "LEGACY_EXTERNAL_ENVIRONMENTS=$($external.Count)"
    Write-Output "STATE_PATH=$statePath"
}
catch {
    Write-Error $_
    exit 2
}
