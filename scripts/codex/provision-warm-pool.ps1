[CmdletBinding()]
param(
    [ValidateRange(6, 10)]
    [int]$TargetWarmSlots = 6,

    [string]$BaseRef = 'origin/main',

    [ValidateSet('mini', 'api', 'web', 'root', 'release')]
    [string]$Profile = 'root',

    [switch]$Json
)

# This is the explicit DependencyMaintenance provisioning channel. Ordinary task routing never calls it.
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

function Canonical([string]$Value) { [IO.Path]::GetFullPath($Value).TrimEnd('\').ToLowerInvariant() }

function Invoke-Git {
    param([string]$WorkingDirectory, [string[]]$Arguments)
    $previous = $PSNativeCommandUseErrorActionPreference
    try {
        $PSNativeCommandUseErrorActionPreference = $false
        $output = @(& git -C $WorkingDirectory @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    }
    finally { $PSNativeCommandUseErrorActionPreference = $previous }
    if ($exitCode -ne 0) { throw "git -C $WorkingDirectory $($Arguments -join ' ') failed: $($output -join ' ')" }
    [pscustomobject]@{ Output = ($output -join [Environment]::NewLine).Trim(); ExitCode = $exitCode }
}

function Parse-Worktrees([string]$Source) {
    $entries = @()
    foreach ($block in ($Source -split '\r?\n\r?\n')) {
        $lines = $block -split '\r?\n'
        $pathLine = $lines | Where-Object { $_.StartsWith('worktree ') } | Select-Object -First 1
        $headLine = $lines | Where-Object { $_.StartsWith('HEAD ') } | Select-Object -First 1
        if (-not $pathLine -or -not $headLine) { continue }
        $branchLine = $lines | Where-Object { $_.StartsWith('branch ') } | Select-Object -First 1
        $entries += [pscustomobject]@{ Path = [IO.Path]::GetFullPath($pathLine.Substring(9)); Head = $headLine.Substring(5); Branch = if ($branchLine) { $branchLine.Substring(7) } else { $null }; Detached = ($lines -contains 'detached') }
    }
    $entries
}

try {
    $hint = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
    $repo = [IO.Path]::GetFullPath((Invoke-Git -WorkingDirectory $hint -Arguments @('rev-parse', '--show-toplevel')).Output)
    $commonRaw = (Invoke-Git -WorkingDirectory $repo -Arguments @('rev-parse', '--git-common-dir')).Output
    $common = if ([IO.Path]::IsPathRooted($commonRaw)) { [IO.Path]::GetFullPath($commonRaw) } else { [IO.Path]::GetFullPath((Join-Path $repo $commonRaw)) }
    $home = [IO.Path]::GetFullPath([IO.Path]::GetDirectoryName($common)).TrimEnd('\')
    $pool = [IO.Path]::GetFullPath((Join-Path $home 'runtime/wt')).TrimEnd('\')
    if ((Canonical $home) -eq (Canonical $pool)) { throw 'Pool root cannot be canonical project home.' }
    if ([IO.Path]::GetPathRoot($home) -ne [IO.Path]::GetPathRoot($pool)) { throw 'Pool must stay on the project volume.' }
    if (Test-Path -LiteralPath $pool) {
        if ((Get-Item -LiteralPath $pool -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Pool root must not be a junction or symlink.' }
    } else { [void](New-Item -ItemType Directory -Path $pool -Force) }
    $driveName = [IO.Path]::GetPathRoot($home).TrimEnd('\').TrimEnd(':')
    $drive = Get-PSDrive -Name $driveName -PSProvider FileSystem
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$driveName`:'"
    $minimumFree = [Math]::Max(20GB, [int64]($disk.Size * 0.15))
    if ([int64]$drive.Free -lt $minimumFree) { throw "Insufficient free space for a safe pool: $($drive.Free) < $minimumFree" }

    $baseCommit = (Invoke-Git -WorkingDirectory $repo -Arguments @('rev-parse', '--verify', "$BaseRef`^{commit}")).Output
    $registered = @(Parse-Worktrees (Invoke-Git -WorkingDirectory $repo -Arguments @('worktree', 'list', '--porcelain')).Output)
    $dependencyScript = Join-Path $PSScriptRoot 'dependency-maintenance.ps1'
    $depsScript = Join-Path $PSScriptRoot 'ensure-worktree-deps.ps1'
    $bootstrapScript = Join-Path $PSScriptRoot 'ensure-workspace-bootstrap.ps1'
    $registerScript = Join-Path $PSScriptRoot 'manage-worktree-pool.ps1'
    $rows = @()
    $installs = 0
    for ($index = 1; $index -le $TargetWarmSlots; $index += 1) {
        $slotPath = [IO.Path]::GetFullPath((Join-Path $pool "general-$index"))
        $existing = $registered | Where-Object { (Canonical $_.Path) -eq (Canonical $slotPath) } | Select-Object -First 1
        if (-not $existing) {
            if (Test-Path -LiteralPath $slotPath) { throw "Slot path exists but is not a registered worktree: $slotPath" }
            [void](Invoke-Git -WorkingDirectory $repo -Arguments @('worktree', 'add', '--detach', $slotPath, $baseCommit))
            $existing = [pscustomobject]@{ Path = $slotPath; Head = $baseCommit; Branch = $null; Detached = $true }
        } elseif (-not $existing.Detached -or $existing.Branch) {
            $status = (Invoke-Git -WorkingDirectory $slotPath -Arguments @('status', '--porcelain=v1', '--untracked-files=all')).Output
            if ($status) { throw "Existing pool target is dirty and cannot be normalized: $slotPath" }
            [void](Invoke-Git -WorkingDirectory $slotPath -Arguments @('switch', '--detach', $baseCommit))
        }
        $maintenanceOutput = & $dependencyScript -Reason "Provision project-local warm slot general-$index" -WorktreeRoot $slotPath
        if ($LASTEXITCODE -ne 0) { throw "DependencyMaintenance failed for $slotPath" }
        if (($maintenanceOutput -join [Environment]::NewLine) -match 'TASK_STATUS=READY_INSTALLED') { $installs += 1 }
        $reuseOutput = & $depsScript -Mode ReuseOnly -WorktreeRoot $slotPath -AdoptHealthyExisting -Json
        if ($LASTEXITCODE -ne 0) { throw "Reuse marker adoption failed for $slotPath" }
        $reuse = (($reuseOutput -join [Environment]::NewLine) | ConvertFrom-Json)
        if ($reuse.taskStatus -ne 'READY_REUSE' -or -not $reuse.dependenciesReused) { throw "Slot is not reusable after maintenance: $slotPath" }
        $bootstrapOutput = & $bootstrapScript -Profile $Profile -WorktreeRoot $slotPath -Json
        if ($LASTEXITCODE -ne 0) { throw "Root bootstrap failed for $slotPath" }
        $bootstrap = (($bootstrapOutput -join [Environment]::NewLine) | ConvertFrom-Json)
        if ($bootstrap.taskStatus -ne 'READY_BOOTSTRAP') { throw "Root bootstrap did not complete for $slotPath" }
        $registerOutput = & $registerScript -Action Register -Path $slotPath -Role general -Index $index -Json
        if ($LASTEXITCODE -ne 0) { throw "Pool registration failed for $slotPath" }
        $registration = (($registerOutput -join [Environment]::NewLine) | ConvertFrom-Json)
        if ($registration.taskStatus -ne 'READY_REUSE') { throw "Pool registration did not return READY_REUSE for $slotPath" }
        $rows += [pscustomobject]@{ slot = "general-$index"; path = $slotPath; head = $baseCommit; dependencyFingerprint = $reuse.dependencyFingerprint; bootstrapBuilt = @($bootstrap.built); bootstrapReused = @($bootstrap.reused); install = ($maintenanceOutput -join [Environment]::NewLine) -match 'TASK_STATUS=READY_INSTALLED' }
    }
    $result = [ordered]@{ targetWarmSlots = $TargetWarmSlots; actualWarmSlots = $rows.Count; baseCommit = $baseCommit; oneTimeInstallCount = $installs; slots = $rows; diskFreeBytes = [int64]$drive.Free; minimumFreeBytes = $minimumFree }
    if ($Json) { $result | ConvertTo-Json -Depth 12 -Compress } else { $result | ConvertTo-Json -Depth 12 }
}
catch {
    Write-Error $_
    exit 2
}
