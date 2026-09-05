[CmdletBinding()]
param(
    [ValidateSet('Register', 'Acquire', 'Heartbeat', 'Release', 'Status', 'ReclaimExpired')]
    [string]$Action = 'Status',

    [string]$PoolRoot,

    [ValidatePattern('^[a-z][a-z0-9-]*$')]
    [string]$Role = 'general',

    [ValidateRange(1, 99)]
    [int]$Index = 1,

    [string]$Path,

    [string]$Owner,

    [string]$SessionId,

    [string]$TaskId,

    [ValidateSet('mini', 'api', 'web', 'root', 'release')]
    [string]$Profile,

    [string]$LeaseToken,

    [string]$BaseRef = 'origin/main',

    [ValidatePattern('^codex/[A-Za-z0-9._/-]+$')]
    [string]$BranchName,

    [ValidateRange(1, 240)]
    [int]$TtlMinutes = 30,

    [switch]$ReconciliationHandoff,

    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

$repositoryHint = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$RepositoryRoot = [IO.Path]::GetFullPath(((& git -C $repositoryHint rev-parse --show-toplevel).Trim()))
$commonRaw = (& git -C $RepositoryRoot rev-parse --git-common-dir).Trim()
$CommonDirectory = if ([IO.Path]::IsPathRooted($commonRaw)) {
    [IO.Path]::GetFullPath($commonRaw)
} else {
    [IO.Path]::GetFullPath((Join-Path $RepositoryRoot $commonRaw))
}
$CanonicalProjectHome = [IO.Path]::GetFullPath([IO.Path]::GetDirectoryName($CommonDirectory)).TrimEnd('\')
$ExpectedPoolRoot = [IO.Path]::GetFullPath((Join-Path $CanonicalProjectHome 'runtime/wt')).TrimEnd('\')
if ($PoolRoot) {
    $requestedPoolRoot = [IO.Path]::GetFullPath($PoolRoot).TrimEnd('\')
    if (-not $requestedPoolRoot.Equals($ExpectedPoolRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "PoolRoot must be the project-local runtime/wt path: $ExpectedPoolRoot"
    }
}
$PoolRoot = $ExpectedPoolRoot
$DependencyScript = Join-Path $PSScriptRoot 'ensure-worktree-deps.ps1'
$BootstrapScript = Join-Path $PSScriptRoot 'ensure-workspace-bootstrap.ps1'
$SlotMarkerName = 'pool-slot-v2.json'
$StateRoot = Join-Path $CanonicalProjectHome 'runtime/codex'
$LocalStateRoot = Join-Path $StateRoot 'state'
$SlotStateRoot = Join-Path $LocalStateRoot 'slots'
$LeaseRoot = Join-Path $StateRoot 'leases'
$LocalConfigPath = Join-Path $LocalStateRoot 'config.json'
if (-not $Owner) { $Owner = "codex-$PID" }
if (-not $SessionId) { $SessionId = [Environment]::GetEnvironmentVariable('CODEX_SESSION_ID') }
if (-not $SessionId) { $SessionId = "unknown-session-$PID" }
if (-not $TaskId) { $TaskId = [Environment]::GetEnvironmentVariable('CODEX_THREAD_ID') }
if (-not $TaskId) { $TaskId = $Owner }

function Get-CanonicalPath {
    param([Parameter(Mandatory = $true)][string]$Value)
    $resolved = [IO.Path]::GetFullPath($Value).TrimEnd('\')
    try { $resolved = [IO.Path]::GetFullPath((Get-Item -LiteralPath $resolved -Force).FullName).TrimEnd('\') } catch { }
    return $resolved.ToLowerInvariant()
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
    finally {
        $PSNativeCommandUseErrorActionPreference = $previous
    }
    if (-not $AllowFailure -and $exitCode -ne 0) {
        throw "git -C $WorkingDirectory $($Arguments -join ' ') failed: $($output -join ' ')"
    }
    return [pscustomobject]@{ ExitCode = $exitCode; Output = ($output -join [Environment]::NewLine).Trim() }
}

function Get-GitValue {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    $result = Invoke-Git -WorkingDirectory $WorkingDirectory -Arguments $Arguments
    if ([string]::IsNullOrWhiteSpace($result.Output)) { throw "git $($Arguments -join ' ') returned no value." }
    return $result.Output
}

function Parse-WorktreeList {
    param([Parameter(Mandatory = $true)][string]$Source)
    $entries = @()
    foreach ($block in ($Source -split '\r?\n\r?\n')) {
        if ([string]::IsNullOrWhiteSpace($block)) { continue }
        $lines = $block -split '\r?\n'
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

function Get-RegisteredWorktrees {
    return @(Parse-WorktreeList (Get-GitValue -WorkingDirectory $RepositoryRoot -Arguments @('worktree', 'list', '--porcelain')))
}

function Assert-PoolBoundary {
    if (-not (Test-Path -LiteralPath $PoolRoot -PathType Container)) {
        [void](New-Item -ItemType Directory -LiteralPath $PoolRoot -Force)
    }
    $poolItem = Get-Item -LiteralPath $PoolRoot -Force
    if (($poolItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Pool root must not be a symbolic link or directory junction.'
    }
    if ((Get-CanonicalPath $PoolRoot) -ne (Get-CanonicalPath $ExpectedPoolRoot)) {
        throw "Pool root is not the canonical project-local runtime/wt path: $PoolRoot"
    }
    if ([IO.Path]::GetPathRoot((Get-CanonicalPath $RepositoryRoot)) -ne [IO.Path]::GetPathRoot((Get-CanonicalPath $PoolRoot))) {
        throw "Pool must be on the repository volume: $PoolRoot"
    }
    foreach ($worktree in Get-RegisteredWorktrees) {
        if ((Get-CanonicalPath $worktree.path) -ne (Get-CanonicalPath $CanonicalProjectHome) -and
            (Test-PathInside -Parent $worktree.path -Child $PoolRoot)) {
            throw "Pool is nested inside a registered worktree: $PoolRoot"
        }
    }
}

function Get-SlotKey {
    param([Parameter(Mandatory = $true)][string]$WorktreePath)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes((Get-CanonicalPath $WorktreePath))
        return -join ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
    }
    finally { $sha.Dispose() }
}

function Get-SlotPaths {
    param([Parameter(Mandatory = $true)][string]$WorktreePath)
    $slotKey = Get-SlotKey $WorktreePath
    return [pscustomobject]@{
        slotKey = $slotKey
        marker = Join-Path $SlotStateRoot "$slotKey.json"
        lease = Join-Path $LeaseRoot "$slotKey.json"
    }
}

function Test-CleanWorktree {
    param([Parameter(Mandatory = $true)][string]$WorktreePath)
    if (-not (Test-Path -LiteralPath $WorktreePath -PathType Container)) { return $false }
    $result = Invoke-Git -WorkingDirectory $WorktreePath -Arguments @('status', '--porcelain=v1', '--untracked-files=all') -AllowFailure
    return $result.ExitCode -eq 0 -and $result.Output -eq ''
}

function Test-StandaloneNodeModules {
    param([Parameter(Mandatory = $true)][string]$WorktreePath)
    $modulesPath = Join-Path $WorktreePath 'node_modules'
    if (-not (Test-Path -LiteralPath $modulesPath)) { return $true }
    $item = Get-Item -LiteralPath $modulesPath -Force
    return ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0
}

function Get-ProcessAncestry {
    param([int]$ProcessId = $PID)
    $ids = @($ProcessId)
    $current = $ProcessId
    for ($index = 0; $index -lt 16; $index += 1) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $current" -ErrorAction SilentlyContinue
        if (-not $process -or [int]$process.ParentProcessId -le 0 -or $ids -contains [int]$process.ParentProcessId) { break }
        $current = [int]$process.ParentProcessId
        $ids += $current
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
        return [pscustomobject]@{ known = $true; count = $matches.Count; method = 'commandline-path' }
    }
    catch { return [pscustomobject]@{ known = $false; count = $null; method = 'process-query-failed' } }
}

function Get-ChildProcessEvidence {
    param([Parameter(Mandatory = $true)][int]$ProcessId)
    try {
        $all = @(Get-CimInstance Win32_Process)
        $pending = [System.Collections.Generic.Queue[int]]::new()
        $pending.Enqueue($ProcessId)
        $children = [System.Collections.Generic.HashSet[int]]::new()
        while ($pending.Count -gt 0) {
            $parent = $pending.Dequeue()
            foreach ($child in @($all | Where-Object { [int]$_.ParentProcessId -eq $parent })) {
                $childId = [int]$child.ProcessId
                if ($children.Add($childId)) {
                    $pending.Enqueue($childId)
                }
            }
        }
        return [pscustomobject]@{ known = $true; count = $children.Count; method = 'process-parent-tree' }
    }
    catch { return [pscustomobject]@{ known = $false; count = $null; method = 'child-process-query-failed' } }
}

function Write-AtomicJson {
    param(
        [Parameter(Mandatory = $true)][string]$Target,
        [Parameter(Mandatory = $true)][object]$Value
    )
    [void](New-Item -ItemType Directory -Path (Split-Path $Target -Parent) -Force)
    $temporary = "$Target.$PID.tmp"
    $encoding = [Text.UTF8Encoding]::new($false)
    [IO.File]::WriteAllText($temporary, (($Value | ConvertTo-Json -Depth 12) + [Environment]::NewLine), $encoding)
    Move-Item -LiteralPath $temporary -Destination $Target -Force
}

function New-AtomicLease {
    param(
        [Parameter(Mandatory = $true)][string]$LeasePath,
        [Parameter(Mandatory = $true)][object]$Lease
    )
    [void](New-Item -ItemType Directory -Path (Split-Path $LeasePath -Parent) -Force)
    $stream = $null
    try {
        $stream = [IO.File]::Open($LeasePath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($Lease | ConvertTo-Json -Depth 12) + [Environment]::NewLine)
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush($true)
        return $true
    }
    catch [IO.IOException] { return $false }
    finally { if ($stream) { $stream.Dispose() } }
}

function Read-Lease {
    param([Parameter(Mandatory = $true)][string]$LeasePath)
    if (-not (Test-Path -LiteralPath $LeasePath -PathType Leaf)) { return $null }
    try { return Get-Content -LiteralPath $LeasePath -Raw | ConvertFrom-Json }
    catch { return [pscustomobject]@{ invalid = $true } }
}

function Get-ManagedSlots {
    $slots = @()
    foreach ($worktree in Get-RegisteredWorktrees) {
        $resolved = Get-CanonicalPath $worktree.path
        if (-not (Test-PathInside -Parent $PoolRoot -Child $resolved) -or $resolved -eq (Get-CanonicalPath $PoolRoot)) { continue }
        if ([IO.Path]::GetDirectoryName($resolved).TrimEnd('\') -ne (Get-CanonicalPath $PoolRoot)) { continue }
        if (-not (Test-Path -LiteralPath $resolved -PathType Container)) { continue }
        $paths = Get-SlotPaths $resolved
        if (-not (Test-Path -LiteralPath $paths.marker -PathType Leaf)) { continue }
        try { $metadata = Get-Content -LiteralPath $paths.marker -Raw | ConvertFrom-Json } catch { continue }
        if ($metadata.schemaVersion -ne 2 -or [string]::IsNullOrWhiteSpace($metadata.path)) { continue }
        if ((Get-CanonicalPath ([string]$metadata.path)) -ne $resolved) { continue }
        if ($metadata.commonDir -and (Get-CanonicalPath ([string]$metadata.commonDir)) -ne (Get-CanonicalPath $CommonDirectory)) { continue }
        $slots += [pscustomobject]@{
            path = $resolved
            head = $worktree.head
            branch = $worktree.branch
            detached = [bool]$worktree.detached
            paths = $paths
            metadata = $metadata
            lease = Read-Lease $paths.lease
            process = Get-ProcessEvidence $resolved
        }
    }
    return $slots
}

function Assert-ManagedSlot {
    param([Parameter(Mandatory = $true)][string]$WorktreePath)
    $resolved = Get-CanonicalPath $WorktreePath
    if ([IO.Path]::GetDirectoryName($resolved).TrimEnd('\') -ne (Get-CanonicalPath $PoolRoot)) {
        throw "Slot must be a direct child of the configured pool: $resolved"
    }
    $slot = Get-ManagedSlots | Where-Object { $_.path -eq $resolved } | Select-Object -First 1
    if (-not $slot) { throw "Slot is not a registered managed worktree: $resolved" }
    return $slot
}

function Get-DependencyCheck {
    param(
        [Parameter(Mandatory = $true)][string]$WorktreePath,
        [string]$Token,
        [switch]$AdoptHealthyExisting
    )
    $parameters = @{
        Mode = 'ReuseOnly'
        WorktreeRoot = $WorktreePath
        Json = $true
    }
    if ($Token) { $parameters.LeaseToken = $Token }
    if ($AdoptHealthyExisting) { $parameters.AdoptHealthyExisting = $true }
    $output = & $DependencyScript @parameters
    return (($output -join [Environment]::NewLine) | ConvertFrom-Json)
}

function Ensure-LocalPoolConfig {
    $commonDir = Get-CanonicalPath $CommonDirectory
    if (Test-Path -LiteralPath $LocalConfigPath -PathType Leaf) {
        $existing = Get-Content -LiteralPath $LocalConfigPath -Raw | ConvertFrom-Json
        if ((Get-CanonicalPath ([string]$existing.commonDir)) -ne $commonDir -or (Get-CanonicalPath ([string]$existing.poolRoot)) -ne (Get-CanonicalPath $PoolRoot)) {
            throw 'Local Schedule pool config belongs to another repository or pool root.'
        }
        return $existing
    }
    $config = [ordered]@{
        schemaVersion = 2
        repositoryRoot = $RepositoryRoot
        commonDir = $commonDir
        poolRoot = $PoolRoot
        createdAt = (Get-Date).ToUniversalTime().ToString('o')
    }
    Write-AtomicJson -Target $LocalConfigPath -Value $config
    return $config
}

function New-Result {
    param(
        [Parameter(Mandatory = $true)][string]$TaskStatus,
        [bool]$DependenciesReused = $false,
        [bool]$InstallInvoked = $false,
        [bool]$WorktreeCreated = $false,
        [string]$Reason,
        [object]$Data
    )
    $result = [ordered]@{
        taskStatus = $TaskStatus
        dependenciesReused = $DependenciesReused
        installInvoked = $InstallInvoked
        worktreeCreated = $WorktreeCreated
        nestedWorktreeCreation = $false
    }
    if ($Reason) { $result.reason = $Reason }
    if ($Data) { $result.data = $Data }
    return [pscustomobject]$result
}

function Write-Result {
    param([Parameter(Mandatory = $true)][object]$Value)
    if ($Json) { $Value | ConvertTo-Json -Depth 12 -Compress }
    else {
        $Value | ConvertTo-Json -Depth 12
        Write-Output "TASK_STATUS=$($Value.taskStatus)"
        Write-Output 'DEPENDENCY_MODE=REUSE_ONLY'
        Write-Output "DEPENDENCIES_REUSED=$(([bool]$Value.dependenciesReused).ToString().ToLowerInvariant())"
        Write-Output "INSTALL_INVOKED=$(([bool]$Value.installInvoked).ToString().ToLowerInvariant())"
        Write-Output "WORKTREE_CREATED=$(([bool]$Value.worktreeCreated).ToString().ToLowerInvariant())"
        if ($Value.PSObject.Properties.Name -contains 'data' -and $Value.data -and $Value.data.PSObject.Properties.Name -contains 'path') {
            Write-Output "ASSIGNED_WORKTREE=$($Value.data.path)"
        }
        Write-Output "HIGHEST_GATE=$($Value.taskStatus)"
        Write-Output "WORKTREE_POOL_ROOT=$PoolRoot"
        Write-Output 'NESTED_WORKTREE_CREATION=false'
    }
}

function Register-Slot {
    Assert-PoolBoundary
    if (-not $Path) { throw 'Register requires -Path.' }
    $resolved = Get-CanonicalPath $Path
    if ([IO.Path]::GetDirectoryName($resolved).TrimEnd('\') -ne (Get-CanonicalPath $PoolRoot)) { throw 'Only direct pool children may be registered.' }
    $registered = Get-RegisteredWorktrees | Where-Object { (Get-CanonicalPath $_.path) -eq $resolved } | Select-Object -First 1
    if (-not $registered) { throw 'The path is not an existing Git worktree.' }
    if (-not $registered.detached -or $registered.branch) { throw 'A free pool slot must be detached; task branches are created only during Acquire.' }
    if (-not (Test-CleanWorktree $resolved)) { throw 'Refusing to register a dirty worktree.' }
    if (-not (Test-StandaloneNodeModules $resolved)) { throw 'node_modules is linked; each slot needs an independent writable tree.' }
    $process = Get-ProcessEvidence $resolved
    if (-not $process.known) { throw 'Could not prove that the slot has no active process.' }
    if ($process.count -ne 0) { return New-Result -TaskStatus 'POOL_BUSY' -Reason 'active-process-observed' }
    $dependency = Get-DependencyCheck -WorktreePath $resolved -AdoptHealthyExisting
    if ($dependency.taskStatus -ne 'READY_REUSE' -or -not $dependency.dependenciesReused) {
        $reason = @($dependency.reasons) -join ','
        if (-not $reason) { $reason = 'dependency environment is not reusable' }
        return New-Result -TaskStatus 'BLOCKED_NO_REUSABLE_DEPENDENCY_ENV' -Reason $reason
    }
    $config = Ensure-LocalPoolConfig
    $paths = Get-SlotPaths $resolved
    $existing = if (Test-Path -LiteralPath $paths.marker -PathType Leaf) { Get-Content -LiteralPath $paths.marker -Raw | ConvertFrom-Json } else { $null }
    $metadata = [ordered]@{
        schemaVersion = 2
        slotMarker = $SlotMarkerName
        role = $Role
        index = $Index
        permanence = 'permanent'
        status = 'free'
        path = $resolved
        commonDir = $config.commonDir
        createdAt = if ($existing) { $existing.createdAt } else { (Get-Date).ToUniversalTime().ToString('o') }
        dependencyFingerprint = $dependency.dependencyFingerprint
        bootstrapProfile = if ($Profile) { $Profile } elseif ($existing) { $existing.bootstrapProfile } else { $null }
        updatedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
    Write-AtomicJson -Target $paths.marker -Value $metadata
    return New-Result -TaskStatus 'READY_REUSE' -DependenciesReused $true -Data ([pscustomobject]@{ path = $resolved; registered = $true; fingerprint = $dependency.dependencyFingerprint })
}

function Resolve-BaseCommit {
    return Get-GitValue -WorkingDirectory $RepositoryRoot -Arguments @('rev-parse', '--verify', "$BaseRef`^{commit}")
}

function Initialize-TaskBranch {
    param(
        [Parameter(Mandatory = $true)][string]$WorktreePath,
        [Parameter(Mandatory = $true)][string]$BaseCommit
    )
    $name = if ($BranchName) { $BranchName } else { "codex/schedule-$PID-$([guid]::NewGuid().ToString('N').Substring(0, 12))" }
    $existing = Invoke-Git -WorkingDirectory $RepositoryRoot -Arguments @('show-ref', '--verify', "refs/heads/$name") -AllowFailure
    if ($existing.ExitCode -eq 0) { throw "Task branch already exists: $name" }
    [void](Invoke-Git -WorkingDirectory $WorktreePath -Arguments @('switch', '--detach', $BaseCommit))
    [void](Invoke-Git -WorkingDirectory $WorktreePath -Arguments @('switch', '--create', $name, $BaseCommit))
    return [pscustomobject]@{ name = "refs/heads/$name"; head = $BaseCommit }
}

function Update-SlotMetadata {
    param(
        [Parameter(Mandatory = $true)][object]$Slot,
        [Parameter(Mandatory = $true)][string]$Status,
        [string]$DependencyFingerprint,
        [string]$BootstrapProfile
    )
    $metadata = [ordered]@{}
    foreach ($property in $Slot.metadata.PSObject.Properties) { $metadata[$property.Name] = $property.Value }
    $metadata.status = $Status
    $metadata.updatedAt = (Get-Date).ToUniversalTime().ToString('o')
    if ($DependencyFingerprint) { $metadata.dependencyFingerprint = $DependencyFingerprint }
    if ($BootstrapProfile) { $metadata.bootstrapProfile = $BootstrapProfile }
    Write-AtomicJson -Target $Slot.paths.marker -Value $metadata
}

function Acquire-Slot {
    Assert-PoolBoundary
    [void](Ensure-LocalPoolConfig)
    $managed = @(Get-ManagedSlots | Where-Object { $_.metadata.role -eq $Role -and (-not $Path -or $_.path -eq (Get-CanonicalPath $Path)) })
    $busySeen = $false
    $incompatibleReasons = @()
    foreach ($slot in ($managed | Sort-Object path)) {
        if ($slot.metadata.status -ne 'free') { $busySeen = $true; continue }
        if ($slot.lease) { $busySeen = $true; continue }
        if (-not $slot.detached -or $slot.branch) { $busySeen = $true; continue }
        if (-not $slot.process.known -or $slot.process.count -ne 0) { $busySeen = $true; continue }
        if (-not (Test-CleanWorktree $slot.path) -or -not (Test-StandaloneNodeModules $slot.path)) { continue }
        try { $dependency = Get-DependencyCheck -WorktreePath $slot.path }
        catch { $incompatibleReasons += "$($slot.path):dependency-check-error"; continue }
        if (($dependency.taskStatus -ne 'READY_REUSE' -or -not $dependency.dependenciesReused) -and -not $ReconciliationHandoff) {
            $incompatibleReasons += "$($slot.path):$($dependency.taskStatus)"
            continue
        }
        $token = [guid]::NewGuid().ToString('D')
        $lease = [ordered]@{
            schemaVersion = 2
            slotId = $slot.paths.slotKey
            baseSha = $null
            token = $token
            path = $slot.path
            sessionId = $SessionId
            taskId = $TaskId
            owner = $Owner
            pid = $PID
            pidStartedAt = (Get-Date).ToUniversalTime().ToString('o')
            acquiredAt = (Get-Date).ToUniversalTime().ToString('o')
            lastHeartbeat = (Get-Date).ToUniversalTime().ToString('o')
            head = $slot.head
            branch = $null
            dependencyFingerprint = $dependency.dependencyFingerprint
            bootstrapProfile = $Profile
            status = 'leased'
        }
        if (-not (New-AtomicLease -LeasePath $slot.paths.lease -Lease $lease)) { $busySeen = $true; continue }
        $branch = $null
        try {
            if (Test-Path -LiteralPath "$($slot.paths.lease).operation") { throw 'Lease operation in progress.' }
            if (Test-Path -LiteralPath $slot.paths.marker) {
                $currentMetadata = Get-Content -LiteralPath $slot.paths.marker -Raw | ConvertFrom-Json
                if ($currentMetadata.status -ne 'free') { throw 'Slot state changed before atomic claim.' }
            }
            $baseCommit = Resolve-BaseCommit
            $branch = Initialize-TaskBranch -WorktreePath $slot.path -BaseCommit $baseCommit
            $lease.head = $branch.head
            $lease.baseSha = $baseCommit
            $lease.branch = $branch.name
            Write-AtomicJson -Target $slot.paths.lease -Value $lease
            $verified = Get-DependencyCheck -WorktreePath $slot.path -Token $token
            if ($verified.taskStatus -ne 'READY_REUSE' -or -not $verified.dependenciesReused) {
                if ($verified.taskStatus -notin @('BLOCKED_DEPENDENCY_INSTALL_REQUIRED', 'BLOCKED_NO_REUSABLE_DEPENDENCY_ENV')) { throw 'Unexpected dependency check failure.' }
                $lease.status = 'NEEDS_RECONCILIATION'
                $lease.dependencyFingerprint = $verified.dependencyFingerprint
                Write-AtomicJson -Target $slot.paths.lease -Value $lease
                Update-SlotMetadata -Slot $slot -Status 'NEEDS_RECONCILIATION' -DependencyFingerprint $verified.dependencyFingerprint -BootstrapProfile $Profile
                return New-Result -TaskStatus 'NEEDS_RECONCILIATION' -Reason (@($verified.reasons) -join ',') -Data ([pscustomobject]@{
                    path = $slot.path; slotId = $slot.paths.slotKey; owner = $Owner; sessionId = $SessionId; taskId = $TaskId
                    leaseToken = $token; head = $branch.head; baseSha = $baseCommit; branch = $branch.name
                    fingerprint = $verified.dependencyFingerprint; profile = $Profile
                })
            }
            $bootstrap = $null
            if ($Profile) {
                $bootstrapOutput = & $BootstrapScript -Profile $Profile -WorktreeRoot $slot.path -LeaseToken $token -Json
                $bootstrap = (($bootstrapOutput -join [Environment]::NewLine) | ConvertFrom-Json)
                if ($bootstrap.taskStatus -ne 'READY_BOOTSTRAP') {
                    throw "Bootstrap did not complete: $(@($bootstrap.reasons) -join ',')"
                }
            }
            Update-SlotMetadata -Slot $slot -Status 'leased' -DependencyFingerprint $verified.dependencyFingerprint -BootstrapProfile $Profile
            return New-Result -TaskStatus 'READY_REUSE' -DependenciesReused $true -Data ([pscustomobject]@{
                    path = $slot.path
                    role = $Role
                    leaseToken = $token
                    sessionId = $SessionId
                    taskId = $TaskId
                    head = $branch.head
                    branch = $branch.name
                    fingerprint = $verified.dependencyFingerprint
                    bootstrap = $bootstrap
                })
        }
        catch {
            $message = $_.Exception.Message
            if ($branch -and (Test-CleanWorktree $slot.path)) {
                try { [void](Invoke-Git -WorkingDirectory $slot.path -Arguments @('switch', '--detach', $branch.head)) } catch { $message += '; slot could not be detached safely' }
            }
            Update-SlotMetadata -Slot $slot -Status 'quarantined-dependency'
            if (Test-Path -LiteralPath $slot.paths.lease -PathType Leaf) { Remove-Item -LiteralPath $slot.paths.lease -Force }
            return New-Result -TaskStatus 'BLOCKED_NO_REUSABLE_DEPENDENCY_ENV' -Reason $message
        }
    }
    if ($busySeen) { return New-Result -TaskStatus 'POOL_BUSY' -Reason 'all compatible slots are leased, active, dirty, or concurrently claimed' }
    if ($incompatibleReasons.Count -gt 0) { return New-Result -TaskStatus 'BLOCKED_NO_REUSABLE_DEPENDENCY_ENV' -Reason ($incompatibleReasons -join ';') }
    return New-Result -TaskStatus 'POOL_BUSY' -Reason 'no free registered warm slot is available; cold worktree creation is disabled'
}

function Assert-OwnedLease {
    param([Parameter(Mandatory = $true)][object]$Slot)
    if (-not $Slot.lease) { throw 'Slot is not leased.' }
    if (-not $LeaseToken -or $Slot.lease.token -ne $LeaseToken) { throw 'Lease token does not own this slot.' }
    if ($Slot.lease.PSObject.Properties.Name -contains 'slotId') {
        if ($Slot.lease.owner -ne $Owner -or $Slot.lease.sessionId -ne $SessionId -or $Slot.lease.taskId -ne $TaskId) { throw 'Lease owner/session/task mismatch.' }
    }
    return $Slot.lease
}

function Heartbeat-Slot {
    Assert-PoolBoundary
    if (-not $Path) { throw 'Heartbeat requires -Path.' }
    $slot = Assert-ManagedSlot $Path
    $lease = Assert-OwnedLease $slot
    $lease.lastHeartbeat = (Get-Date).ToUniversalTime().ToString('o')
    Write-AtomicJson -Target $slot.paths.lease -Value $lease
    $ready = $lease.status -in @('leased', 'READY_REUSE')
    $status = if ($ready) { 'READY_REUSE' } else { $lease.status }
    return New-Result -TaskStatus $status -DependenciesReused $ready -Data ([pscustomobject]@{ path = $slot.path; heartbeat = $lease.lastHeartbeat })
}

function Release-Slot {
    Assert-PoolBoundary
    if (-not $Path) { throw 'Release requires -Path.' }
    $slot = Assert-ManagedSlot $Path
    $lease = Assert-OwnedLease $slot
    if (-not (Test-CleanWorktree $slot.path)) {
        Update-SlotMetadata -Slot $slot -Status 'quarantined-dirty'
        return New-Result -TaskStatus 'QUARANTINED_DIRTY' -Reason 'dirty worktree is protected; release does not reset or clean it'
    }
    if (-not $slot.process.known -or $slot.process.count -ne 0) { throw 'Refusing to release while an active process is observed or process evidence is unavailable.' }
    $children = Get-ChildProcessEvidence ([int]$lease.pid)
    if (-not $children.known -or $children.count -ne 0) {
        throw "Refusing to release while child process evidence is unavailable or active (known=$($children.known), count=$($children.count), leasePid=$($lease.pid))."
    }
    if ($lease.status -in @('NEEDS_RECONCILIATION', 'QUARANTINED_RECONCILIATION')) {
        $head = Get-GitValue -WorkingDirectory $slot.path -Arguments @('rev-parse', 'HEAD')
        [void](Invoke-Git -WorkingDirectory $slot.path -Arguments @('switch', '--detach', $head))
        Update-SlotMetadata -Slot $slot -Status 'quarantined-dependency'
        Remove-Item -LiteralPath $slot.paths.lease -Force
        return New-Result -TaskStatus 'QUARANTINED_RECONCILIATION' -Data ([pscustomobject]@{ path = $slot.path; released = $true })
    }
    $dependency = Get-DependencyCheck -WorktreePath $slot.path -Token $LeaseToken
    if ($dependency.taskStatus -ne 'READY_REUSE' -or -not $dependency.dependenciesReused) {
        Update-SlotMetadata -Slot $slot -Status 'quarantined-dependency'
        return New-Result -TaskStatus 'BLOCKED_DEPENDENCY_INSTALL_REQUIRED' -Reason (@($dependency.reasons) -join ',')
    }
    $head = Get-GitValue -WorkingDirectory $slot.path -Arguments @('rev-parse', 'HEAD')
    [void](Invoke-Git -WorkingDirectory $slot.path -Arguments @('switch', '--detach', $head))
    Update-SlotMetadata -Slot $slot -Status 'free' -DependencyFingerprint $dependency.dependencyFingerprint
    Remove-Item -LiteralPath $slot.paths.lease -Force
    return New-Result -TaskStatus 'READY_REUSE' -DependenciesReused $true -Data ([pscustomobject]@{ path = $slot.path; released = $true; head = $head })
}

function Test-PidAlive {
    param([int]$ProcessId)
    return $null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Test-ExpiredLease {
    param([Parameter(Mandatory = $true)][object]$Slot)
    if (-not $Slot.lease -or $Slot.lease.path -ne $Slot.path) { return $false }
    if ($Slot.lease.head -ne $Slot.head -or $Slot.lease.branch -ne $Slot.branch) { return $false }
    $heartbeat = [DateTime]::Parse($Slot.lease.lastHeartbeat).ToUniversalTime()
    if (((Get-Date).ToUniversalTime() - $heartbeat).TotalMinutes -le $TtlMinutes) { return $false }
    if (Test-PidAlive ([int]$Slot.lease.pid)) { return $false }
    if (-not $Slot.process.known -or $Slot.process.count -ne 0) { return $false }
    $children = Get-ChildProcessEvidence ([int]$Slot.lease.pid)
    if (-not $children.known -or $children.count -ne 0) { return $false }
    return Test-CleanWorktree $Slot.path
}

function Reclaim-ExpiredLeases {
    Assert-PoolBoundary
    $candidates = if ($Path) { @(Assert-ManagedSlot $Path) } else { @(Get-ManagedSlots) }
    $reclaimed = @()
    foreach ($slot in $candidates) {
        $reclaimOperation = "$($slot.paths.lease).operation"
        $reclaimStream = $null
        try {
            try { $reclaimStream = [IO.File]::Open($reclaimOperation, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None) }
            catch [IO.IOException] { continue }
            $slot.lease = Read-Lease $slot.paths.lease
        if (Test-ExpiredLease $slot) {
            $head = Get-GitValue -WorkingDirectory $slot.path -Arguments @('rev-parse', 'HEAD')
            [void](Invoke-Git -WorkingDirectory $slot.path -Arguments @('switch', '--detach', $head))
            Update-SlotMetadata -Slot $slot -Status 'free'
            Remove-Item -LiteralPath $slot.paths.lease -Force
            $reclaimed += $slot.path
        }
        } finally {
            if ($reclaimStream) { $reclaimStream.Dispose(); Remove-Item -LiteralPath $reclaimOperation -Force }
        }
    }
    return New-Result -TaskStatus 'READY_REUSE' -Data ([pscustomobject]@{ reclaimed = $reclaimed; count = $reclaimed.Count })
}

function Get-ModulesStoreDir {
    param([Parameter(Mandatory = $true)][string]$WorktreePath)
    $metadataPath = Join-Path $WorktreePath 'node_modules/.modules.yaml'
    if (-not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) { return $null }
    try { return [string]((Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json).storeDir) } catch { return $null }
}

function Get-PoolStatus {
    Assert-PoolBoundary
    $rows = @()
    foreach ($slot in Get-ManagedSlots) {
        $dependency = $null
        if (-not $slot.lease -and $slot.metadata.status -eq 'free' -and $slot.detached -and $slot.process.known -and $slot.process.count -eq 0 -and (Test-CleanWorktree $slot.path)) {
            try { $dependency = Get-DependencyCheck -WorktreePath $slot.path } catch { $dependency = $null }
        }
        $rows += [pscustomobject]@{
            path = $slot.path
            role = $slot.metadata.role
            index = $slot.metadata.index
            permanence = $slot.metadata.permanence
            status = $slot.metadata.status
            head = $slot.head
            branch = $slot.branch
            detached = $slot.detached
            clean = Test-CleanWorktree $slot.path
            nodeModules = Test-Path -LiteralPath (Join-Path $slot.path 'node_modules') -PathType Container
            modulesYaml = Test-Path -LiteralPath (Join-Path $slot.path 'node_modules/.modules.yaml') -PathType Leaf
            storeDir = Get-ModulesStoreDir $slot.path
            processEvidence = $slot.process
            leased = $null -ne $slot.lease
            sessionId = if ($slot.lease) { $slot.lease.sessionId } else { $null }
            taskId = if ($slot.lease) { $slot.lease.taskId } else { $null }
            compatible = if ($dependency) { [bool]$dependency.dependenciesReused } else { $false }
            dependencyFingerprint = if ($dependency) { $dependency.dependencyFingerprint } else { $slot.metadata.dependencyFingerprint }
            bootstrapProfile = $slot.metadata.bootstrapProfile
        }
    }
    $available = @($rows | Where-Object { $_.status -eq 'free' -and $_.detached -and $_.clean -and -not $_.leased -and $_.compatible -eq $true -and $_.processEvidence.known -and $_.processEvidence.count -eq 0 }).Count
    $occupied = @($rows | Where-Object { $_.leased }).Count
    $status = if ($available -gt 0) { 'READY_REUSE' } else { 'POOL_BUSY' }
    return New-Result -TaskStatus $status -DependenciesReused ($available -gt 0) -Data ([pscustomobject]@{
            poolRoot = $PoolRoot
            repositoryRoot = $RepositoryRoot
            slots = $rows
            registeredWarmSlots = $rows.Count
            availableSlots = $available
            occupiedSlots = $occupied
            maxNoInstallConcurrency = $available
            nestedWorktreeCreation = $false
        })
}

$operationPath = $null
$operationStream = $null
try {
    if ($Action -in @('Release', 'Heartbeat')) {
        if (-not $Path) { throw 'Lease mutations require an exact -Path.' }
        $operationPath = (Get-SlotPaths (Get-CanonicalPath $Path)).lease + '.operation'
        $operationStream = [IO.File]::Open($operationPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    }
    $result = switch ($Action) {
        'Register' { Register-Slot }
        'Acquire' { Acquire-Slot }
        'Heartbeat' { Heartbeat-Slot }
        'Release' { Release-Slot }
        'ReclaimExpired' { Reclaim-ExpiredLeases }
        'Status' { Get-PoolStatus }
    }
    Write-Result $result
}
catch {
    $errorResult = New-Result -TaskStatus 'BLOCKED_POOL_POLICY' -Reason $_.Exception.Message
    Write-Result $errorResult
    exit 2
}

finally {
    if ($operationStream) { $operationStream.Dispose(); Remove-Item -LiteralPath $operationPath -Force }
}
