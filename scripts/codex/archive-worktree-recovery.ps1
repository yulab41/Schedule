[CmdletBinding()]
param(
    [string[]]$SkipPath = @(),

    [string[]]$KeepPath = @(),

    [switch]$DeleteStale,

    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

function Get-CanonicalPath {
    param([Parameter(Mandatory = $true)][string]$Value)
    return [IO.Path]::GetFullPath($Value).TrimEnd('\').ToLowerInvariant()
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [switch]$AllowFailure
    )
    $previous = $PSNativeCommandUseErrorActionPreference
    try {
        $PSNativeCommandUseErrorActionPreference = $false
        $output = @(& git -C $WorkingDirectory @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    }
    finally { $PSNativeCommandUseErrorActionPreference = $previous }
    if (-not $AllowFailure -and $exitCode -ne 0) {
        throw "git -C $WorkingDirectory $($Arguments -join ' ') failed: $($output -join ' ')"
    }
    return [pscustomobject]@{ exitCode = $exitCode; text = ($output -join [Environment]::NewLine).Trim() }
}

function Parse-Worktrees {
    param([Parameter(Mandatory = $true)][string]$Source)
    $entries = @()
    $current = $null
    foreach ($line in ($Source -split '\r?\n')) {
        if ($line -like 'worktree *') {
            if ($null -ne $current) { $entries += [pscustomobject]$current }
            $current = [ordered]@{ path = [IO.Path]::GetFullPath($line.Substring(9)); head = ''; branch = $null; detached = $false }
        } elseif ($null -ne $current -and $line -like 'HEAD *') {
            $current.head = $line.Substring(5)
        } elseif ($null -ne $current -and $line -like 'branch *') {
            $current.branch = $line.Substring(7)
        } elseif ($null -ne $current -and $line -eq 'detached') {
            $current.detached = $true
        }
    }
    if ($null -ne $current) { $entries += [pscustomobject]$current }
    return $entries
}

function Get-ProcessAncestry {
    $ids = [System.Collections.Generic.HashSet[int]]::new()
    $current = $PID
    $ids.Add($current) | Out-Null
    for ($index = 0; $index -lt 16; $index += 1) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $current" -ErrorAction SilentlyContinue
        if ($null -eq $process -or [int]$process.ParentProcessId -le 0 -or $ids.Contains([int]$process.ParentProcessId)) { break }
        $current = [int]$process.ParentProcessId
        $ids.Add($current) | Out-Null
    }
    return $ids
}

function Get-ProcessEvidence {
    param([Parameter(Mandatory = $true)][string]$WorktreePath)
    $target = (Get-CanonicalPath $WorktreePath).Replace('\', '/')
    $excluded = Get-ProcessAncestry
    try {
        $matches = @(Get-CimInstance Win32_Process | Where-Object {
                $id = [int]$_.ProcessId
                $id -notin $excluded -and ([string]$_.CommandLine).ToLowerInvariant().Replace('\', '/').Contains($target)
            })
        return [ordered]@{ known = $true; count = @($matches).Count; method = 'commandline-path' }
    }
    catch { return [ordered]@{ known = $false; count = $null; method = 'process-query-failed' } }
}

function Get-LeaseEvidence {
    param(
        [Parameter(Mandatory = $true)][string]$LeaseRoot,
        [Parameter(Mandatory = $true)][string]$WorktreePath
    )
    $matches = @()
    foreach ($file in @(Get-ChildItem -LiteralPath $LeaseRoot -Filter '*.json' -File -ErrorAction SilentlyContinue)) {
        try {
            $lease = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
            if ([string]$lease.path -and (Get-CanonicalPath ([string]$lease.path)) -eq (Get-CanonicalPath $WorktreePath)) {
                $matches += $file.Name
            }
        }
        catch { $matches += $file.Name }
    }
    return [ordered]@{ present = (@($matches).Count -gt 0); count = @($matches).Count; files = $matches }
}

function Get-FileSha256OrNull {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not [IO.File]::Exists($Path)) { return $null }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Write-TextFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Value
    )
    [void](New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force)
    [IO.File]::WriteAllText($Path, $Value, [Text.UTF8Encoding]::new($false))
}

function Write-RecoveryManifest {
    param(
        [Parameter(Mandatory = $true)][string]$RecoveryDirectory,
        [Parameter(Mandatory = $true)][object]$Manifest
    )
    [void](New-Item -ItemType Directory -Path $RecoveryDirectory -Force)
    $path = Join-Path $RecoveryDirectory 'manifest.json'
    Write-TextFile -Path $path -Value (($Manifest | ConvertTo-Json -Depth 12) + [Environment]::NewLine)
    return $path
}

try {
    $repositoryHint = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
    $repositoryRoot = [IO.Path]::GetFullPath((Invoke-Git -WorkingDirectory $repositoryHint -Arguments @('rev-parse', '--show-toplevel')).text)
    $commonRaw = (Invoke-Git -WorkingDirectory $repositoryRoot -Arguments @('rev-parse', '--git-common-dir')).text
    $commonDirectory = if ([IO.Path]::IsPathRooted($commonRaw)) { [IO.Path]::GetFullPath($commonRaw) } else { [IO.Path]::GetFullPath((Join-Path $repositoryRoot $commonRaw)) }
    $canonicalProjectHome = [IO.Path]::GetFullPath([IO.Path]::GetDirectoryName($commonDirectory)).TrimEnd('\')
    $poolRoot = Get-CanonicalPath (Join-Path $canonicalProjectHome 'runtime/wt')
    $recoveryRoot = Join-Path $canonicalProjectHome 'runtime/codex/recovery'
    $leaseRoot = Join-Path $canonicalProjectHome 'runtime/codex/leases'
    $skip = @($SkipPath | ForEach-Object { Get-CanonicalPath $_ })
    $keep = @($KeepPath | ForEach-Object { Get-CanonicalPath $_ })
    $entries = @(Parse-Worktrees (Invoke-Git -WorkingDirectory $repositoryRoot -Arguments @('worktree', 'list', '--porcelain')).text)
    $baseCheck = Invoke-Git -WorkingDirectory $repositoryRoot -Arguments @('rev-parse', '--verify', 'origin/main^{commit}') -AllowFailure
    if ($baseCheck.exitCode -ne 0) { throw 'origin/main is required for recovery classification.' }
    $baseCommit = $baseCheck.text
    $rows = @()
    $archived = 0
    $deleted = 0
    $skipped = 0
    foreach ($entry in $entries) {
        $path = [IO.Path]::GetFullPath($entry.path)
        $canonical = Get-CanonicalPath $path
        $isCanonical = $canonical -eq (Get-CanonicalPath $canonicalProjectHome)
        $isPool = $canonical.StartsWith("$poolRoot\", [StringComparison]::OrdinalIgnoreCase)
        if ($isCanonical -or $isPool) { continue }
        if ($skip -contains $canonical) {
            $skipped += 1
            continue
        }
        $status = (Invoke-Git -WorkingDirectory $path -Arguments @('status', '--porcelain=v1', '--untracked-files=all') -AllowFailure).text
        $statusLines = if ([string]::IsNullOrWhiteSpace($status)) { @() } else { @($status -split '\r?\n' | Where-Object { $_ -ne '' }) }
        $head = $entry.head
        $aheadResult = Invoke-Git -WorkingDirectory $path -Arguments @('rev-list', '--count', "$baseCommit..$head") -AllowFailure
        $ahead = if ($aheadResult.exitCode -eq 0) { [int]$aheadResult.text } else { -1 }
        $process = Get-ProcessEvidence $path
        $lease = Get-LeaseEvidence -LeaseRoot $leaseRoot -WorktreePath $path
        $hookConfig = Test-Path -LiteralPath (Join-Path $path '.codex/hooks.json') -PathType Leaf
        $slugSource = $path.Substring($canonicalProjectHome.Length).TrimStart('\').Replace('\', '_').Replace('/', '_')
        if ([string]::IsNullOrWhiteSpace($slugSource)) { $slugSource = 'worktree' }
        $slug = ($slugSource -replace '[^A-Za-z0-9._-]', '-')
        $recoveryDirectory = Join-Path $recoveryRoot "$slug-$($head.Substring(0, 8))"
        $patchFiles = @()
        $recoveryRef = $null
        if ($ahead -gt 0) {
            $archived += 1
            if ($entry.branch) {
                $recoveryRef = $entry.branch
            } else {
                $candidateRef = "codex/recovery/$slug-$($head.Substring(0, 8))"
                $refCheck = Invoke-Git -WorkingDirectory $repositoryRoot -Arguments @('show-ref', '--verify', "refs/heads/$candidateRef") -AllowFailure
                if ($refCheck.exitCode -ne 0) {
                    [void](Invoke-Git -WorkingDirectory $repositoryRoot -Arguments @('branch', '--no-track', $candidateRef, $head))
                }
                $recoveryRef = "refs/heads/$candidateRef"
            }
            $patchPath = Join-Path $recoveryDirectory 'tracked-commits.patch'
            $patchOutput = (Invoke-Git -WorkingDirectory $path -Arguments @('diff', '--binary', "$baseCommit...$head")).text
            Write-TextFile -Path $patchPath -Value ($patchOutput + [Environment]::NewLine)
            $patchFiles += [pscustomobject]@{ path = 'tracked-commits.patch'; sha256 = Get-FileSha256OrNull $patchPath }
        }
        if (@($statusLines).Count -gt 0) {
            $indexPatchPath = Join-Path $recoveryDirectory 'tracked-index.patch'
            $worktreePatchPath = Join-Path $recoveryDirectory 'tracked-working-tree.patch'
            $indexOutput = (Invoke-Git -WorkingDirectory $path -Arguments @('diff', '--binary', '--cached')).text
            $worktreeOutput = (Invoke-Git -WorkingDirectory $path -Arguments @('diff', '--binary')).text
            Write-TextFile -Path $indexPatchPath -Value ($indexOutput + [Environment]::NewLine)
            Write-TextFile -Path $worktreePatchPath -Value ($worktreeOutput + [Environment]::NewLine)
            $patchFiles += [pscustomobject]@{ path = 'tracked-index.patch'; sha256 = Get-FileSha256OrNull $indexPatchPath }
            $patchFiles += [pscustomobject]@{ path = 'tracked-working-tree.patch'; sha256 = Get-FileSha256OrNull $worktreePatchPath }
        }
        $classification = if (@($statusLines).Count -gt 0) { 'B_DIRTY_RETAINED' } elseif ($ahead -gt 0) { 'B_UNIQUE_COMMIT' } else { 'C_STALE_CANDIDATE' }
        $eligibleForDelete = $DeleteStale -and $classification -eq 'C_STALE_CANDIDATE' -and $process.known -and $process.count -eq 0 -and -not $lease.present -and ($keep -notcontains $canonical)
        $deletedThisRow = $false
        $deleteError = $null
        if ($DeleteStale -and $classification -eq 'B_UNIQUE_COMMIT' -and @($statusLines).Count -eq 0 -and $process.known -and $process.count -eq 0 -and -not $lease.present -and ($keep -notcontains $canonical)) {
            if ($null -eq $recoveryRef) { throw "No recovery ref was created for unique worktree: $path" }
            $eligibleForDelete = $true
        }
        $manifest = [ordered]@{
            schemaVersion = 1
            generatedAt = (Get-Date).ToUniversalTime().ToString('o')
            canonicalProjectHome = $canonicalProjectHome
            baseRef = 'origin/main'
            originalPath = $path
            head = $head
            branch = $entry.branch
            recoveryRef = $recoveryRef
            clean = (@($statusLines).Count -eq 0)
            statusEntryCount = @($statusLines).Count
            uniqueCommitsAhead = $ahead
            processEvidence = $process
            leaseEvidence = $lease
            hookConfigPresent = $hookConfig
            patchFiles = $patchFiles
            untrackedPolicy = if ($statusLines | Where-Object { $_ -like '?? *' }) { 'not-archived; original dirty worktree retained to protect possible user data' } else { 'none' }
            classification = $classification
            deleteRequested = [bool]$DeleteStale
            deleteEligible = [bool]$eligibleForDelete
            deleted = $false
        }
        $manifestPath = Write-RecoveryManifest -RecoveryDirectory $recoveryDirectory -Manifest $manifest
        if ($eligibleForDelete) {
            # All deletion predicates above are re-evaluated from the current Git/process snapshot;
            # --force is only for Git's Windows long-path cleanup and never replaces those predicates.
            try {
                [void](Invoke-Git -WorkingDirectory $repositoryRoot -Arguments @('worktree', 'remove', '--force', '--', $path))
                $deletedThisRow = $true
                $deleted += 1
                $manifest.deleted = $true
            }
            catch {
                $deleteError = $_.Exception.Message
                $manifest.deleteError = $deleteError
                Write-Warning "Stale worktree retained after Git-aware removal failed: $path; $deleteError"
            }
            Write-RecoveryManifest -RecoveryDirectory $recoveryDirectory -Manifest $manifest | Out-Null
        }
        $rows += [pscustomobject]@{ path = $path; head = $head; classification = $classification; recoveryManifest = $manifestPath; recoveryRef = $recoveryRef; deleted = $deletedThisRow; deleteError = $deleteError; processCount = $process.count; leasePresent = $lease.present; statusEntries = @($statusLines).Count; uniqueCommitsAhead = $ahead; hookConfigPresent = $hookConfig }
    }
    $result = [ordered]@{ canonicalProjectHome = $canonicalProjectHome; recoveryRoot = $recoveryRoot; baseRef = 'origin/main'; entriesScanned = $entries.Count; archivedUnique = $archived; deleted = $deleted; skipped = $skipped; rows = $rows }
    if ($Json) { $result | ConvertTo-Json -Depth 12 -Compress } else {
        $result | ConvertTo-Json -Depth 12
        Write-Output "WORKTREES_SCANNED=$($entries.Count)"
        Write-Output "RECOVERY_ARCHIVED_UNIQUE=$archived"
        Write-Output "STALE_WORKTREES_DELETED=$deleted"
        Write-Output "WORKTREES_SKIPPED=$skipped"
    }
}
catch {
    Write-Error $_
    exit 2
}
