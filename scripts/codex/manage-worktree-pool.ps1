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

    [ValidateRange(1, 240)]
    [int]$TtlMinutes = 30,

    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

$repositoryHint = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$RepositoryRoot = (& git -C $repositoryHint rev-parse --show-toplevel).Trim()
$RepositoryRoot = [IO.Path]::GetFullPath($RepositoryRoot)
if (-not $PoolRoot) { $PoolRoot = Join-Path ([IO.Path]::GetPathRoot($RepositoryRoot)) 'ScheduleWT' }
$PoolRoot = [IO.Path]::GetFullPath($PoolRoot).TrimEnd('\')
$DependencyScript = Join-Path $PSScriptRoot 'ensure-worktree-deps.ps1'
$BootstrapScript = Join-Path $PSScriptRoot 'ensure-workspace-bootstrap.ps1'
$SlotMarkerName = 'pool-slot-v1.json'
$LeaseName = 'slot-lease-v1.lock'
$codexHome = [Environment]::GetEnvironmentVariable('CODEX_HOME')
if ([string]::IsNullOrWhiteSpace($codexHome)) { $codexHome = Join-Path $env:USERPROFILE '.codex' }
$LocalStateRoot = Join-Path ([IO.Path]::GetFullPath($codexHome)) 'schedule-worktree-pool'
$LocalConfigPath = Join-Path $LocalStateRoot 'config.json'
if (-not $Owner) { $Owner = "codex-$PID" }
if (-not $SessionId) { $SessionId = [Environment]::GetEnvironmentVariable('CODEX_SESSION_ID') }
if (-not $SessionId) { $SessionId = "unknown-session-$PID" }
if (-not $TaskId) { $TaskId = [Environment]::GetEnvironmentVariable('CODEX_THREAD_ID') }
if (-not $TaskId) { $TaskId = $Owner }

function Get-CanonicalPath {
    param([Parameter(Mandatory = $true)][string]$Value)
    return [IO.Path]::GetFullPath($Value).TrimEnd('\').ToLowerInvariant()
}

function Test-PathInside {
    param(
        [Parameter(Mandatory = $true)][string]$Parent,
        [Parameter(Mandatory = $true)][string]$Child
    )
    $parentCanonical = Get-CanonicalPath $Parent
    $childCanonical = Get-CanonicalPath $Child
    return $childCanonical -eq $parentCanonical -or $childCanonical.StartsWith("$parentCanonical\", [StringComparison]::OrdinalIgnoreCase)
}

function Get-CommonDirectory {
    $raw = (& git -C $RepositoryRoot rev-parse --git-common-dir).Trim()
    if ([IO.Path]::IsPathRooted($raw)) { return [IO.Path]::GetFullPath($raw) }
    return [IO.Path]::GetFullPath((Join-Path $RepositoryRoot $raw))
}

function Get-RegisteredWorktrees {
    $raw = @(& git -C $RepositoryRoot worktree list --porcelain) -join "`n"
    $entries = @()
    foreach ($block in ($raw -split "`n`n")) {
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

function Assert-PoolBoundary {
    if (-not (Test-Path -LiteralPath $PoolRoot -PathType Container)) {
        throw "Pool root does not exist: $PoolRoot"
    }
    if ([IO.Path]::GetPathRoot((Get-CanonicalPath $RepositoryRoot)) -ne [IO.Path]::GetPathRoot((Get-CanonicalPath $PoolRoot))) {
        throw "Pool must be on the repository volume: $PoolRoot"
    }
    foreach ($worktree in Get-RegisteredWorktrees) {
        if (Test-PathInside -Parent $worktree.path -Child $PoolRoot) {
            throw "Pool is nested inside a registered worktree: $PoolRoot"
        }
    }
}

function Get-SlotStateDirectory {
    param([Parameter(Mandatory = $true)][string]$WorktreePath)
    $gitDirectory = (& git -C $WorktreePath rev-parse --absolute-git-dir).Trim()
    return Join-Path $gitDirectory 'schedule-worktree-state'
}

function Get-SlotPaths {
    param([Parameter(Mandatory = $true)][string]$WorktreePath)
    $stateDirectory = Get-SlotStateDirectory $WorktreePath
    return [pscustomobject]@{
        stateDirectory = $stateDirectory
        marker = Join-Path $stateDirectory $SlotMarkerName
        lease = Join-Path $stateDirectory $LeaseName
    }
}

function Test-CleanWorktree {
    param([Parameter(Mandatory = $true)][string]$WorktreePath)
    if (-not (Test-Path -LiteralPath $WorktreePath -PathType Container)) { return $false }
    $status = @(& git -C $WorktreePath status --porcelain=v1 --untracked-files=all)
    return $status.Count -eq 0
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
    catch {
        return [pscustomobject]@{ known = $false; count = $null; method = 'process-query-failed' }
    }
}

function Get-ChildProcessEvidence {
    param([Parameter(Mandatory = $true)][int]$ProcessId)
    try {
        $all = @(Get-CimInstance Win32_Process)
        $pending = @($ProcessId)
        $children = @()
        while ($pending.Count -gt 0) {
            $parent = $pending[0]
            if ($pending.Count -eq 1) { $pending = @() } else { $pending = @($pending | Select-Object -Skip 1) }
            $direct = @($all | Where-Object { [int]$_.ParentProcessId -eq [int]$parent })
            foreach ($child in $direct) {
                if ($children -notcontains [int]$child.ProcessId) {
                    $children += [int]$child.ProcessId
                    $pending += [int]$child.ProcessId
                }
            }
        }
        return [pscustomobject]@{ known = $true; count = $children.Count; method = 'process-parent-tree' }
    }
    catch {
        return [pscustomobject]@{ known = $false; count = $null; method = 'child-process-query-failed' }
    }
}

function Write-AtomicJson {
    param(
        [Parameter(Mandatory = $true)][string]$Target,
        [Parameter(Mandatory = $true)][object]$Value
    )
    [void](New-Item -ItemType Directory -Path (Split-Path $Target -Parent) -Force)
    $temporary = "$Target.$PID.tmp"
    $encoding = [Text.UTF8Encoding]::new($false)
    [IO.File]::WriteAllText($temporary, (($Value | ConvertTo-Json -Depth 10) + "`n"), $encoding)
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
        $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($Lease | ConvertTo-Json -Depth 10) + "`n")
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush($true)
        return $true
    }
    catch [IO.IOException] { return $false }
    finally {
        if ($stream) { $stream.Dispose() }
    }
}

function Read-Lease {
    param([Parameter(Mandatory = $true)][string]$LeasePath)
    if (-not (Test-Path -LiteralPath $LeasePath -PathType Leaf)) { return $null }
    return Get-Content -LiteralPath $LeasePath -Raw | ConvertFrom-Json
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
        $metadata = Get-Content -LiteralPath $paths.marker -Raw | ConvertFrom-Json
        $lease = Read-Lease $paths.lease
        $process = Get-ProcessEvidence $resolved
        $slots += [pscustomobject]@{
            path = $resolved
            head = $worktree.head
            branch = $worktree.branch
            paths = $paths
            metadata = $metadata
            lease = $lease
            process = $process
        }
    }
    return $slots
}

function Assert-ManagedSlot {
    param([Parameter(Mandatory = $true)][string]$WorktreePath)
    $resolved = Get-CanonicalPath $WorktreePath
    if (-not (Test-PathInside -Parent $PoolRoot -Child $resolved) -or $resolved -eq (Get-CanonicalPath $PoolRoot)) {
        throw "Slot is outside the configured pool: $resolved"
    }
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
        [string]$Token
    )
    if ($Token) {
        $output = & $DependencyScript -Mode ReuseOnly -WorktreeRoot $WorktreePath -LeaseToken $Token -Json
    }
    else {
        $output = & $DependencyScript -Mode ReuseOnly -WorktreeRoot $WorktreePath -Json
    }
    return (($output -join "`n") | ConvertFrom-Json)
}

function Ensure-LocalPoolConfig {
    $commonDir = Get-CanonicalPath (Get-CommonDirectory)
    if (Test-Path -LiteralPath $LocalConfigPath -PathType Leaf) {
        $existing = Get-Content -LiteralPath $LocalConfigPath -Raw | ConvertFrom-Json
        if ((Get-CanonicalPath $existing.commonDir) -ne $commonDir -or (Get-CanonicalPath $existing.poolRoot) -ne (Get-CanonicalPath $PoolRoot)) {
            throw 'Local Schedule pool config belongs to another repository or pool root.'
        }
        return $existing
    }
    $config = [ordered]@{
        schemaVersion = 1
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
        if ($Value.taskStatus) { Write-Output "TASK_STATUS=$($Value.taskStatus)" }
        $installInvoked = ([bool]$Value.installInvoked).ToString().ToLowerInvariant()
        $worktreeCreated = ([bool]$Value.worktreeCreated).ToString().ToLowerInvariant()
        Write-Output "INSTALL_INVOKED=$installInvoked"
        Write-Output "WORKTREE_CREATED=$worktreeCreated"
    }
}

function Register-Slot {
    Assert-PoolBoundary
    if (-not $Path) { throw 'Register requires -Path.' }
    $resolved = Get-CanonicalPath $Path
    if ([IO.Path]::GetDirectoryName($resolved).TrimEnd('\') -ne (Get-CanonicalPath $PoolRoot)) { throw 'Only direct pool children may be registered.' }
    $registered = Get-RegisteredWorktrees | Where-Object { (Get-CanonicalPath $_.path) -eq $resolved } | Select-Object -First 1
    if (-not $registered) { throw 'The path is not an existing Git worktree.' }
    if (-not (Test-CleanWorktree $resolved)) { throw 'Refusing to register a dirty worktree.' }
    if (-not (Test-StandaloneNodeModules $resolved)) { throw 'node_modules is linked; each slot needs an independent writable tree.' }
    $process = Get-ProcessEvidence $resolved
    if (-not $process.known) { throw 'Could not prove that the slot has no active process.' }
    if ($process.count -ne 0) { return New-Result -TaskStatus 'POOL_BUSY' -Reason 'active-process-observed' }
    $dependency = Get-DependencyCheck $resolved
    if ($dependency.taskStatus -ne 'READY_REUSE' -or -not $dependency.dependenciesReused) {
        $reason = $dependency.reasons -join ','
        if (-not $reason) { $reason = 'dependency environment is not reusable' }
        return New-Result -TaskStatus 'BLOCKED_NO_REUSABLE_DEPENDENCY_ENV' -Reason $reason
    }
    $config = Ensure-LocalPoolConfig
    $paths = Get-SlotPaths $resolved
    $existing = if (Test-Path -LiteralPath $paths.marker -PathType Leaf) { Get-Content -LiteralPath $paths.marker -Raw | ConvertFrom-Json } else { $null }
    $metadata = [ordered]@{
        schemaVersion = 1
        role = $Role
        index = $Index
        permanence = 'permanent'
        status = 'free'
        path = $resolved
        commonDir = $config.commonDir
        createdAt = if ($existing) { $existing.createdAt } else { (Get-Date).ToUniversalTime().ToString('o') }
        dependencyFingerprint = $dependency.dependencyFingerprint
        bootstrapProfile = $null
    }
    Write-AtomicJson -Target $paths.marker -Value $metadata
    return New-Result -TaskStatus 'READY_REUSE' -DependenciesReused $true -Data ([pscustomobject]@{ path = $resolved; registered = $true; fingerprint = $dependency.dependencyFingerprint })
}

function Acquire-Slot {
    Assert-PoolBoundary
    [void](Ensure-LocalPoolConfig)
    $managed = @(Get-ManagedSlots | Where-Object { $_.metadata.role -eq $Role })
    $freeSeen = $false
    $busySeen = $false
    $incompatibleReasons = @()
    foreach ($slot in ($managed | Sort-Object path)) {
        if ($slot.lease) { $busySeen = $true; continue }
        if (-not $slot.process.known -or $slot.process.count -ne 0) { $busySeen = $true; continue }
        if (-not (Test-CleanWorktree $slot.path) -or -not (Test-StandaloneNodeModules $slot.path)) { continue }
        $freeSeen = $true
        try { $dependency = Get-DependencyCheck $slot.path }
        catch { $incompatibleReasons += "${slot.path}:dependency-check-error"; continue }
        if ($dependency.taskStatus -ne 'READY_REUSE' -or -not $dependency.dependenciesReused) {
            $incompatibleReasons += "${slot.path}:$($dependency.taskStatus)"
            continue
        }
        $token = [guid]::NewGuid().ToString('D')
        $lease = [ordered]@{
            schemaVersion = 1
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
            branch = $slot.branch
            dependencyFingerprint = $dependency.dependencyFingerprint
            bootstrapProfile = $Profile
            status = 'leased'
        }
        if (-not (New-AtomicLease -LeasePath $slot.paths.lease -Lease $lease)) { $busySeen = $true; continue }
        try {
            $verified = Get-DependencyCheck -WorktreePath $slot.path -Token $token
            if ($verified.taskStatus -ne 'READY_REUSE' -or -not $verified.dependenciesReused) {
                Remove-Item -LiteralPath $slot.paths.lease -Force
                $reason = $verified.reasons -join ','
                if (-not $reason) { $reason = 'dependency changed while acquiring' }
                return New-Result -TaskStatus 'BLOCKED_DEPENDENCY_INSTALL_REQUIRED' -Reason $reason
            }
            $bootstrap = $null
            if ($Profile) {
                $bootstrapOutput = & $BootstrapScript -Profile $Profile -WorktreeRoot $slot.path -LeaseToken $token -Json
                $bootstrap = (($bootstrapOutput -join "`n") | ConvertFrom-Json)
                if ($bootstrap.taskStatus -ne 'READY_BOOTSTRAP') {
                    $reason = $bootstrap.reasons -join ','
                    if (-not $reason) { $reason = 'bootstrap did not complete' }
                    return New-Result -TaskStatus $bootstrap.taskStatus -Reason $reason -Data ([pscustomobject]@{ path = $slot.path; leaseToken = $token })
                }
            }
            return New-Result -TaskStatus 'READY_REUSE' -DependenciesReused $true -Data ([pscustomobject]@{
                    path = $slot.path
                    role = $Role
                    leaseToken = $token
                    sessionId = $SessionId
                    taskId = $TaskId
                    fingerprint = $verified.dependencyFingerprint
                    bootstrap = $bootstrap
                })
        }
        catch {
            throw
        }
    }
    if ($busySeen) { return New-Result -TaskStatus 'POOL_BUSY' -Reason 'all compatible slots are leased, active, dirty, or concurrently claimed' }
    if ($freeSeen -and $incompatibleReasons.Count -gt 0) {
        return New-Result -TaskStatus 'BLOCKED_NO_REUSABLE_DEPENDENCY_ENV' -Reason ($incompatibleReasons -join ';')
    }
    return New-Result -TaskStatus 'BLOCKED_NO_REUSABLE_DEPENDENCY_ENV' -Reason 'no registered warm slot is available'
}

function Assert-OwnedLease {
    param([Parameter(Mandatory = $true)][object]$Slot)
    if (-not $Slot.lease) { throw 'Slot is not leased.' }
    if (-not $LeaseToken -or $Slot.lease.token -ne $LeaseToken) { throw 'Lease token does not own this slot.' }
    return $Slot.lease
}

function Heartbeat-Slot {
    Assert-PoolBoundary
    if (-not $Path) { throw 'Heartbeat requires -Path.' }
    $slot = Assert-ManagedSlot $Path
    $lease = Assert-OwnedLease $slot
    $lease.lastHeartbeat = (Get-Date).ToUniversalTime().ToString('o')
    $lease.status = 'leased'
    Write-AtomicJson -Target $slot.paths.lease -Value $lease
    return New-Result -TaskStatus 'READY_REUSE' -DependenciesReused $true -Data ([pscustomobject]@{ path = $slot.path; heartbeat = $lease.lastHeartbeat })
}

function Release-Slot {
    Assert-PoolBoundary
    if (-not $Path) { throw 'Release requires -Path.' }
    $slot = Assert-ManagedSlot $Path
    [void](Assert-OwnedLease $slot)
    if (-not (Test-CleanWorktree $slot.path)) { throw 'Refusing to release a dirty slot.' }
    if (-not $slot.process.known -or $slot.process.count -ne 0) { throw 'Refusing to release while an active process is observed or process evidence is unavailable.' }
    $children = Get-ChildProcessEvidence ([int]$slot.lease.pid)
    if (-not $children.known -or $children.count -ne 0) { throw 'Refusing to release while child process evidence is unavailable or active.' }
    Remove-Item -LiteralPath $slot.paths.lease -Force
    return New-Result -TaskStatus 'READY_REUSE' -DependenciesReused $true -Data ([pscustomobject]@{ path = $slot.path; released = $true })
}

function Test-PidAlive {
    param([int]$ProcessId)
    return $null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Test-ExpiredLease {
    param([Parameter(Mandatory = $true)][object]$Slot)
    if (-not $Slot.lease) { return $false }
    if ($Slot.lease.path -ne $Slot.path -or $Slot.lease.head -ne $Slot.head -or $Slot.lease.branch -ne $Slot.branch) { return $false }
    $heartbeat = [DateTime]::Parse($Slot.lease.lastHeartbeat).ToUniversalTime()
    if (((Get-Date).ToUniversalTime() - $heartbeat).TotalMinutes -le $TtlMinutes) { return $false }
    if (Test-PidAlive ([int]$Slot.lease.pid)) { return $false }
    if (-not $Slot.process.known -or $Slot.process.count -ne 0) { return $false }
    $children = Get-ChildProcessEvidence ([int]$Slot.lease.pid)
    if (-not $children.known -or $children.count -ne 0) { return $false }
    if (-not (Test-CleanWorktree $Slot.path)) { return $false }
    return $true
}

function Reclaim-ExpiredLeases {
    Assert-PoolBoundary
    $candidates = if ($Path) { @(Assert-ManagedSlot $Path) } else { @(Get-ManagedSlots) }
    $reclaimed = @()
    foreach ($slot in $candidates) {
        if (Test-ExpiredLease $slot) {
            Remove-Item -LiteralPath $slot.paths.lease -Force
            $reclaimed += $slot.path
        }
    }
    return New-Result -TaskStatus 'READY_REUSE' -Data ([pscustomobject]@{ reclaimed = $reclaimed; count = $reclaimed.Count })
}

function Get-PoolStatus {
    Assert-PoolBoundary
    $rows = @()
    foreach ($slot in Get-ManagedSlots) {
        $dependency = $null
        if (-not $slot.lease -and $slot.process.known -and $slot.process.count -eq 0 -and (Test-CleanWorktree $slot.path)) {
            try { $dependency = Get-DependencyCheck $slot.path } catch { $dependency = $null }
        }
        $rows += [pscustomobject]@{
            path = $slot.path
            role = $slot.metadata.role
            index = $slot.metadata.index
            permanence = $slot.metadata.permanence
            head = $slot.head
            branch = $slot.branch
            clean = Test-CleanWorktree $slot.path
            nodeModulesMarker = Test-Path -LiteralPath (Join-Path $slot.path 'node_modules/.modules.yaml')
            processEvidence = $slot.process
            leased = $null -ne $slot.lease
            sessionId = if ($slot.lease) { $slot.lease.sessionId } else { $null }
            taskId = if ($slot.lease) { $slot.lease.taskId } else { $null }
            compatible = if ($dependency) { [bool]$dependency.dependenciesReused } else { $null }
            dependencyFingerprint = if ($dependency) { $dependency.dependencyFingerprint } else { $null }
        }
    }
    $available = @($rows | Where-Object { $_.clean -and -not $_.leased -and $_.compatible -eq $true -and $_.processEvidence.known -and $_.processEvidence.count -eq 0 }).Count
    $occupied = @($rows | Where-Object { $_.leased }).Count
    $reserve = @($rows | Where-Object { $_.permanence -eq 'reserve' }).Count
    return New-Result -TaskStatus 'READY_REUSE' -DependenciesReused ($available -gt 0) -Data ([pscustomobject]@{
            poolRoot = $PoolRoot
            repositoryRoot = $RepositoryRoot
            slots = $rows
            registeredWarmSlots = $rows.Count
            availableSlots = $available
            occupiedSlots = $occupied
            reserveSlots = $reserve
            maxNoInstallConcurrency = $available
        })
}

try {
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
