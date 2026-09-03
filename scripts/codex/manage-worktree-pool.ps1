[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Initialize', 'Acquire', 'Release', 'Status', 'ClearOutputs')]
  [string]$Action,

  [string]$PoolRoot,

  [ValidatePattern('^[a-z][a-z0-9-]*$')]
  [string]$Role = 'general',

  [ValidateRange(1, 16)]
  [int]$Count = 1,

  [string]$Ref,

  [string]$Owner = "codex-$PID",

  [string]$Path,

  [string]$LeaseToken,

  [switch]$SkipDependencyEnsure,

  [switch]$Json
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

$RepositoryRoot = (& git -C (Join-Path $PSScriptRoot '../..') rev-parse --show-toplevel).Trim()
if (-not $PoolRoot) {
  $PoolRoot = Join-Path ([IO.Path]::GetPathRoot($RepositoryRoot)) 'ScheduleWT'
}
$PoolRoot = [IO.Path]::GetFullPath($PoolRoot).TrimEnd('\')
$DependencyScript = Join-Path $PSScriptRoot 'ensure-worktree-deps.ps1'
$SlotMarkerName = 'pool-slot-v1.json'
$LeaseName = 'slot-lease-v1.lock'
$AllowedDisposableOutputs = @(
  'apps/*/dist',
  'infra/scripts/dist',
  'tests/*/dist'
)

function Get-CanonicalPath {
  param([Parameter(Mandatory = $true)][string]$Value)
  return [IO.Path]::GetFullPath($Value).TrimEnd('\').ToLowerInvariant()
}

function Test-PathInside {
  param(
    [Parameter(Mandatory = $true)][string]$Parent,
    [Parameter(Mandatory = $true)][string]$Child
  )
  $relative = [IO.Path]::GetRelativePath($Parent, $Child)
  return $relative -eq '.' -or (-not $relative.StartsWith('..') -and -not [IO.Path]::IsPathRooted($relative))
}

function Get-RegisteredWorktrees {
  $raw = (& git -C $RepositoryRoot worktree list --porcelain) -join "`n"
  $entries = @()
  foreach ($block in ($raw -split "`n`n")) {
    if ([string]::IsNullOrWhiteSpace($block)) { continue }
    $lines = $block -split "`n"
    $pathLine = $lines | Where-Object { $_.StartsWith('worktree ') } | Select-Object -First 1
    $headLine = $lines | Where-Object { $_.StartsWith('HEAD ') } | Select-Object -First 1
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

function Assert-ExternalSameVolumePool {
  $repository = Get-CanonicalPath $RepositoryRoot
  $pool = Get-CanonicalPath $PoolRoot
  if ([IO.Path]::GetPathRoot($repository) -ne [IO.Path]::GetPathRoot($pool)) {
    throw "Worktree pool must use the repository volume: $PoolRoot"
  }
  foreach ($worktree in Get-RegisteredWorktrees) {
    $registered = Get-CanonicalPath $worktree.path
    if (Test-PathInside -Parent $registered -Child $pool) {
      throw "Worktree pool must be outside every registered worktree: $PoolRoot"
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
  $status = @(& git -C $WorktreePath status --porcelain=v1 --untracked-files=all)
  return $status.Count -eq 0
}

function Assert-StandaloneNodeModules {
  param([Parameter(Mandatory = $true)][string]$WorktreePath)
  $modulesPath = Join-Path $WorktreePath 'node_modules'
  if (-not (Test-Path -LiteralPath $modulesPath)) { return }
  $item = Get-Item -LiteralPath $modulesPath -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "The writable node_modules root must be local to its slot, not a ReparsePoint: $modulesPath"
  }
}

function Write-LocalJson {
  param(
    [Parameter(Mandatory = $true)][string]$Target,
    [Parameter(Mandatory = $true)][object]$Value
  )
  [void](New-Item -ItemType Directory -Path (Split-Path $Target -Parent) -Force)
  $encoding = [Text.UTF8Encoding]::new($false)
  [IO.File]::WriteAllText($Target, (($Value | ConvertTo-Json -Depth 8) + "`n"), $encoding)
}

function Get-DependencyCheck {
  param([Parameter(Mandatory = $true)][string]$WorktreePath)
  $output = & $DependencyScript -WorktreeRoot $WorktreePath -CheckOnly -Json
  return (($output -join "`n") | ConvertFrom-Json)
}

function Assert-ManagedSlot {
  param([Parameter(Mandatory = $true)][string]$WorktreePath)
  $resolved = [IO.Path]::GetFullPath($WorktreePath).TrimEnd('\')
  if (-not (Test-PathInside -Parent $PoolRoot -Child $resolved) -or $resolved -eq $PoolRoot) {
    throw "Slot is outside the configured pool: $resolved"
  }
  $registered = Get-RegisteredWorktrees | Where-Object {
    (Get-CanonicalPath $_.path) -eq (Get-CanonicalPath $resolved)
  }
  if (-not $registered) { throw "Slot is not a registered worktree: $resolved" }
  $paths = Get-SlotPaths $resolved
  if (-not (Test-Path -LiteralPath $paths.marker)) {
    throw "Slot is not managed by this pool: $resolved"
  }
  return [pscustomobject]@{
    path = $resolved
    paths = $paths
    metadata = Get-Content -Raw $paths.marker | ConvertFrom-Json
  }
}

function New-AtomicLease {
  param(
    [Parameter(Mandatory = $true)][string]$LeasePath,
    [Parameter(Mandatory = $true)][object]$Lease
  )
  [void](New-Item -ItemType Directory -Path (Split-Path $LeasePath -Parent) -Force)
  $stream = $null
  try {
    $stream = [IO.File]::Open(
      $LeasePath,
      [IO.FileMode]::CreateNew,
      [IO.FileAccess]::Write,
      [IO.FileShare]::None
    )
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($Lease | ConvertTo-Json -Depth 6) + "`n")
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush($true)
  } finally {
    if ($stream) { $stream.Dispose() }
  }
}

function Read-OwnedLease {
  param(
    [Parameter(Mandatory = $true)][object]$Slot,
    [Parameter(Mandatory = $true)][string]$Token
  )
  if (-not (Test-Path -LiteralPath $Slot.paths.lease)) {
    throw "Slot is not leased: $($Slot.path)"
  }
  $lease = Get-Content -Raw $Slot.paths.lease | ConvertFrom-Json
  if ($lease.token -ne $Token) { throw 'Lease token does not own this slot.' }
  return $lease
}

function Get-ManagedSlots {
  $slots = @()
  foreach ($worktree in Get-RegisteredWorktrees) {
    $resolved = [IO.Path]::GetFullPath($worktree.path).TrimEnd('\')
    if (-not (Test-PathInside -Parent $PoolRoot -Child $resolved) -or $resolved -eq $PoolRoot) {
      continue
    }
    $paths = Get-SlotPaths $resolved
    if (-not (Test-Path -LiteralPath $paths.marker)) { continue }
    $slots += [pscustomobject]@{
      path = $resolved
      head = $worktree.head
      branch = $worktree.branch
      paths = $paths
      metadata = Get-Content -Raw $paths.marker | ConvertFrom-Json
    }
  }
  return $slots
}

function Write-Result {
  param([Parameter(Mandatory = $true)][object]$Value)
  if ($Json) { $Value | ConvertTo-Json -Depth 8 -Compress }
  else { $Value | Format-List | Out-String | Write-Output }
}

Assert-ExternalSameVolumePool

switch ($Action) {
  'Initialize' {
    [void](New-Item -ItemType Directory -Path $PoolRoot -Force)
    $worktrees = Get-RegisteredWorktrees
    $created = @()
    $targetRef = if ($Ref) { $Ref } else { 'HEAD' }
    for ($index = 1; $index -le $Count; $index += 1) {
      $target = [IO.Path]::GetFullPath((Join-Path $PoolRoot "$Role-$index"))
      if ([IO.Path]::GetDirectoryName($target) -ne $PoolRoot) {
        throw "Managed slots must be direct children of the pool: $target"
      }
      $registered = $worktrees | Where-Object {
        (Get-CanonicalPath $_.path) -eq (Get-CanonicalPath $target)
      }
      $wasCreated = $false
      if (-not $registered) {
        if (Test-Path -LiteralPath $target) {
          throw "Target exists but is not a registered worktree: $target"
        }
        & git -C $RepositoryRoot worktree add --detach $target $targetRef
        $wasCreated = $true
      } elseif (-not (Test-Path -LiteralPath $target)) {
        throw "Git registers the slot but its directory is missing: $target"
      }
      if (-not (Test-CleanWorktree $target)) { throw "Managed slot must be clean: $target" }
      Assert-StandaloneNodeModules $target
      $paths = Get-SlotPaths $target
      if (-not $wasCreated -and -not (Test-Path -LiteralPath $paths.marker) -and $registered.branch) {
        throw "Refusing to adopt an unmarked user branch as a managed slot: $target"
      }
      $dependency = $null
      if (-not $SkipDependencyEnsure) {
        $output = & $DependencyScript -WorktreeRoot $target -Json
        $dependency = ($output -join "`n") | ConvertFrom-Json
      }
      Write-LocalJson -Target $paths.marker -Value ([ordered]@{
          schemaVersion = 1
          role = $Role
          index = $index
          createdAt = (Get-Date).ToUniversalTime().ToString('o')
        })
      $created += [pscustomobject]@{
        path = $target
        role = $Role
        created = $wasCreated
        dependenciesReused = if ($dependency) { $dependency.dependenciesReused } else { $null }
      }
    }
    Write-Result $created
  }

  'Acquire' {
    $candidates = @()
    foreach ($slot in (Get-ManagedSlots | Where-Object { $_.metadata.role -eq $Role })) {
      if (Test-Path -LiteralPath $slot.paths.lease) { continue }
      if (-not (Test-CleanWorktree $slot.path)) { continue }
      Assert-StandaloneNodeModules $slot.path
      try {
        $dependency = Get-DependencyCheck $slot.path
        $candidates += [pscustomobject]@{
          slot = $slot
          compatible = [bool]$dependency.compatible
          dependency = $dependency
        }
      } catch {
        continue
      }
    }
    $candidates = @($candidates | Sort-Object `
        @{ Expression = { $_.compatible }; Descending = $true }, `
        @{ Expression = { $_.slot.path }; Descending = $false })
    if ($candidates.Count -eq 0) { throw "No free clean '$Role' worktree slot is available." }

    $acquired = $null
    foreach ($candidate in $candidates) {
      $token = [guid]::NewGuid().ToString('D')
      $lease = [ordered]@{
        schemaVersion = 1
        token = $token
        owner = $Owner
        pid = $PID
        acquiredAt = (Get-Date).ToUniversalTime().ToString('o')
      }
      try {
        New-AtomicLease -LeasePath $candidate.slot.paths.lease -Lease $lease
      } catch [IO.IOException] {
        continue
      }
      try {
        if ($Ref) {
          if (-not (Test-CleanWorktree $candidate.slot.path)) {
            throw "Slot became dirty before checkout: $($candidate.slot.path)"
          }
          & git -C $candidate.slot.path checkout --detach $Ref
        }
        $output = & $DependencyScript -WorktreeRoot $candidate.slot.path -Json
        $dependency = ($output -join "`n") | ConvertFrom-Json
        $acquired = [pscustomobject]@{
          path = $candidate.slot.path
          role = $Role
          leaseToken = $token
          owner = $Owner
          dependenciesReused = $dependency.dependenciesReused
          dependenciesInstalled = $dependency.installed
          fingerprint = $dependency.fingerprint
        }
        break
      } catch {
        Remove-Item -LiteralPath $candidate.slot.paths.lease -Force
        throw
      }
    }
    if (-not $acquired) { throw "Every '$Role' slot was leased concurrently; retry later." }
    Write-Result $acquired
  }

  'Release' {
    if (-not $Path -or -not $LeaseToken) { throw 'Release requires -Path and -LeaseToken.' }
    $slot = Assert-ManagedSlot $Path
    [void](Read-OwnedLease -Slot $slot -Token $LeaseToken)
    if (-not (Test-CleanWorktree $slot.path)) {
      throw 'Refusing to release a dirty slot; preserve or commit the task files first.'
    }
    Remove-Item -LiteralPath $slot.paths.lease -Force
    Write-Result ([pscustomobject]@{ path = $slot.path; released = $true })
  }

  'Status' {
    $status = foreach ($slot in Get-ManagedSlots) {
      $dependency = $null
      if (-not (Test-Path -LiteralPath $slot.paths.lease) -and (Test-CleanWorktree $slot.path)) {
        try { $dependency = Get-DependencyCheck $slot.path } catch { $dependency = $null }
      }
      [pscustomobject]@{
        path = $slot.path
        role = $slot.metadata.role
        head = $slot.head.Substring(0, 8)
        clean = Test-CleanWorktree $slot.path
        leased = Test-Path -LiteralPath $slot.paths.lease
        compatible = if ($dependency) { [bool]$dependency.compatible } else { $null }
      }
    }
    Write-Result @($status)
  }

  'ClearOutputs' {
    if (-not $Path -or -not $LeaseToken) { throw 'ClearOutputs requires -Path and -LeaseToken.' }
    $slot = Assert-ManagedSlot $Path
    [void](Read-OwnedLease -Slot $slot -Token $LeaseToken)
    $targets = @()
    foreach ($application in Get-ChildItem -LiteralPath (Join-Path $slot.path 'apps') -Directory -ErrorAction SilentlyContinue) {
      $targets += Join-Path $application.FullName 'dist'
    }
    $targets += Join-Path $slot.path 'infra/scripts/dist'
    foreach ($testPackage in Get-ChildItem -LiteralPath (Join-Path $slot.path 'tests') -Directory -ErrorAction SilentlyContinue) {
      $targets += Join-Path $testPackage.FullName 'dist'
    }
    $removed = @()
    foreach ($target in $targets) {
      $resolvedTarget = [IO.Path]::GetFullPath($target)
      if (-not (Test-PathInside -Parent $slot.path -Child $resolvedTarget)) {
        throw "Cleanup target escapes the slot: $resolvedTarget"
      }
      if (Test-Path -LiteralPath $resolvedTarget) {
        Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
        $removed += [IO.Path]::GetRelativePath($slot.path, $resolvedTarget).Replace('\', '/')
      }
    }
    Write-Result ([pscustomobject]@{
        path = $slot.path
        allowlist = $AllowedDisposableOutputs
        removed = $removed
      })
  }
}
