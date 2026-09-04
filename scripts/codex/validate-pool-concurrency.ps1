[CmdletBinding()]
param(
    [ValidateRange(2, 10)]
    [int]$ExpectedSlots = 6,

    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

function Invoke-GitText {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    $previous = $PSNativeCommandUseErrorActionPreference
    try {
        $PSNativeCommandUseErrorActionPreference = $false
        $output = @(& git -C $WorkingDirectory @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    }
    finally { $PSNativeCommandUseErrorActionPreference = $previous }
    if ($exitCode -ne 0) { throw "git -C $WorkingDirectory $($Arguments -join ' ') failed: $($output -join ' ')" }
    return ($output -join [Environment]::NewLine).Trim()
}

function Parse-WorktreeCount {
    param([Parameter(Mandatory = $true)][string]$Source)
    return @($Source -split '\r?\n' | Where-Object { $_ -like 'worktree *' }).Count
}

function Read-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    $text = Get-Content -LiteralPath $Path -Raw
    if ([string]::IsNullOrWhiteSpace($text)) { throw "Child process produced no JSON: $Path" }
    return $text | ConvertFrom-Json
}

function Release-LeaseRecord {
    param([Parameter(Mandatory = $true)][object]$Record)
    $output = @(& $scriptPath -Action Release -Path ([string]$Record.path) -LeaseToken ([string]$Record.token) -Json)
    if ($LASTEXITCODE -ne 0) { throw "pool release failed for $($Record.path): $($output -join ' ')" }
    $result = (($output -join [Environment]::NewLine) | ConvertFrom-Json)
    if ($result.taskStatus -ne 'READY_REUSE') { throw "pool release was not READY_REUSE for $($Record.path)" }
    return $result
}

$repositoryHint = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$repositoryRoot = [IO.Path]::GetFullPath((Invoke-GitText -WorkingDirectory $repositoryHint -Arguments @('rev-parse', '--show-toplevel')))
$scriptPath = Join-Path $repositoryRoot 'scripts/codex/manage-worktree-pool.ps1'
$stateRoot = Join-Path $repositoryRoot 'runtime/codex/state/pool-concurrency'
$runId = [guid]::NewGuid().ToString('N')
$runRoot = Join-Path $stateRoot $runId
[void](New-Item -ItemType Directory -Path $runRoot -Force)
$taskPrefix = "pool-concurrency-$runId-"
$beforeCount = Parse-WorktreeCount (Invoke-GitText -WorkingDirectory $repositoryRoot -Arguments @('worktree', 'list', '--porcelain'))
$childProcesses = @()
$acquired = @()
$released = @()
$overflow = $null

try {
    for ($index = 1; $index -le $ExpectedSlots; $index += 1) {
        $stdoutPath = Join-Path $runRoot "acquire-$index.out"
        $stderrPath = Join-Path $runRoot "acquire-$index.err"
        $arguments = @(
            '-NoProfile',
            '-File',
            $scriptPath,
            '-Action',
            'Acquire',
            '-Role',
            'general',
            '-SessionId',
            "$taskPrefix$index",
            '-TaskId',
            "$taskPrefix$index",
            '-Owner',
            'pool-concurrency-validation',
            '-BaseRef',
            'origin/main',
            '-Json'
        )
        $process = Start-Process -FilePath (Join-Path $PSHOME 'pwsh.exe') -ArgumentList $arguments -WorkingDirectory $repositoryRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
        $childProcesses += [pscustomobject]@{ index = $index; process = $process; stdout = $stdoutPath; stderr = $stderrPath }
    }
    foreach ($child in $childProcesses) { $child.process.WaitForExit() }

    foreach ($child in $childProcesses) {
        $result = Read-JsonFile -Path $child.stdout
        if ($child.process.ExitCode -ne 0 -or $result.taskStatus -ne 'READY_REUSE') {
            $errorText = if (Test-Path -LiteralPath $child.stderr) { Get-Content -LiteralPath $child.stderr -Raw } else { '' }
            throw "Acquire child $($child.index) did not return READY_REUSE: $($result | ConvertTo-Json -Compress) $errorText"
        }
        $acquired += [pscustomobject]@{
            index = $child.index
            path = [string]$result.data.path
            token = [string]$result.data.leaseToken
            taskId = "$taskPrefix$($child.index)"
            branch = [string]$result.data.branch
        }
    }
    if (@($acquired | Select-Object -ExpandProperty path -Unique).Count -ne $ExpectedSlots) {
        throw 'Concurrent Acquire returned duplicate slot paths.'
    }
    $leaseFiles = @(Get-ChildItem -LiteralPath (Join-Path $repositoryRoot 'runtime/codex/leases') -Filter '*.json' -File -ErrorAction SilentlyContinue | ForEach-Object {
            $lease = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
            if ([string]$lease.taskId -like "$taskPrefix*") { $lease }
        })
    if ($leaseFiles.Count -ne $ExpectedSlots) { throw "Expected $ExpectedSlots test leases, found $($leaseFiles.Count)." }

    $afterAcquireCount = Parse-WorktreeCount (Invoke-GitText -WorkingDirectory $repositoryRoot -Arguments @('worktree', 'list', '--porcelain'))
    if ($afterAcquireCount -ne $beforeCount) { throw 'Concurrent Acquire created or removed a Git worktree.' }

    $overflowOutput = @(& $scriptPath -Action Acquire -Role general -SessionId "$taskPrefix-overflow" -TaskId "$taskPrefix-overflow" -Owner 'pool-concurrency-validation' -BaseRef 'origin/main' -Json)
    if ($LASTEXITCODE -ne 0) { throw "pool overflow manager call failed: $($overflowOutput -join ' ')" }
    $overflow = (($overflowOutput -join [Environment]::NewLine) | ConvertFrom-Json)
    if ($overflow.taskStatus -ne 'POOL_BUSY' -or [bool]$overflow.installInvoked -or [bool]$overflow.worktreeCreated) {
        throw "Pool overflow did not fail closed: $($overflow | ConvertTo-Json -Compress)"
    }
}
finally {
    $recordsToRelease = @($acquired)
    $recordsToRelease += @(Get-ChildItem -LiteralPath (Join-Path $repositoryRoot 'runtime/codex/leases') -Filter '*.json' -File -ErrorAction SilentlyContinue | ForEach-Object {
            $lease = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
            if ([string]$lease.taskId -like "$taskPrefix*") { [pscustomobject]@{ path = $lease.path; token = $lease.token } }
        })
    $recordsToRelease = @($recordsToRelease | Group-Object token | ForEach-Object { $_.Group[0] })
    foreach ($record in $recordsToRelease) {
        try { $released += Release-LeaseRecord -Record $record }
        catch { Write-Warning $_ }
    }
}

$afterReleaseCount = Parse-WorktreeCount (Invoke-GitText -WorkingDirectory $repositoryRoot -Arguments @('worktree', 'list', '--porcelain'))
if ($afterReleaseCount -ne $beforeCount) { throw 'Pool release changed the registered Git worktree count.' }
$finalStatusOutput = @(& $scriptPath -Action Status -Json)
if ($LASTEXITCODE -ne 0) { throw "pool status manager call failed: $($finalStatusOutput -join ' ')" }
$finalStatus = (($finalStatusOutput -join [Environment]::NewLine) | ConvertFrom-Json)
$generalSlots = @($finalStatus.data.slots | Where-Object { $_.role -eq 'general' })
$healthyGeneral = @($generalSlots | Where-Object { $_.status -eq 'free' -and $_.detached -and $_.clean -and -not $_.leased -and $_.compatible -eq $true -and $_.nodeModules -and $_.modulesYaml }).Count
if ($generalSlots.Count -ne $ExpectedSlots -or $healthyGeneral -ne $ExpectedSlots) {
    throw "General slots are not all free and healthy after release: $($finalStatus | ConvertTo-Json -Compress)"
}

$result = [ordered]@{
    runId = $runId
    expectedSlots = $ExpectedSlots
    acquiredSlots = @($acquired | Select-Object -ExpandProperty path -Unique).Count
    releasedSlots = $released.Count
    distinctPaths = (@($acquired | Select-Object -ExpandProperty path -Unique).Count -eq $ExpectedSlots)
    beforeWorktrees = $beforeCount
    afterWorktrees = $afterReleaseCount
    overflowTaskStatus = $overflow.taskStatus
    overflowInstallInvoked = [bool]$overflow.installInvoked
    overflowWorktreeCreated = [bool]$overflow.worktreeCreated
    poolOverflowBehavior = 'POOL_BUSY'
}
if ($Json) { $result | ConvertTo-Json -Depth 10 -Compress } else {
    $result | ConvertTo-Json -Depth 10
    Write-Output "POOL_CONCURRENCY_ACQUIRE=$($result.acquiredSlots)"
    Write-Output "POOL_CONCURRENCY_DISTINCT_PATHS=$(([bool]$result.distinctPaths).ToString().ToLowerInvariant())"
    Write-Output "POOL_OVERFLOW_STATUS=$($result.overflowTaskStatus)"
    Write-Output "POOL_OVERFLOW_INSTALL_INVOKED=$(([bool]$result.overflowInstallInvoked).ToString().ToLowerInvariant())"
    Write-Output "POOL_OVERFLOW_WORKTREE_CREATED=$(([bool]$result.overflowWorktreeCreated).ToString().ToLowerInvariant())"
    Write-Output "POOL_RELEASED=$($result.releasedSlots)"
}
