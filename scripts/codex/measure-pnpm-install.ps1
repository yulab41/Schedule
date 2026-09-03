[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$WorktreeRoot,

  [Parameter(Mandatory = $true)]
  [string]$EvidenceDirectory,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z0-9-]+$')]
  [string]$Label,

  [switch]$EnableGlobalVirtualStore,

  [ValidateRange(1, 30)]
  [int]$SampleIntervalSeconds = 3
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

function Get-TreeStatistics {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return [pscustomobject]@{ files = 0; directories = 0; bytes = 0 }
  }

  [long]$files = 0
  [long]$directories = 0
  [long]$bytes = 0
  foreach ($item in Get-ChildItem -LiteralPath $Path -Force -Recurse -ErrorAction Stop) {
    if ($item.PSIsContainer) {
      $directories += 1
    } else {
      $files += 1
      $bytes += $item.Length
    }
  }
  return [pscustomobject]@{ files = $files; directories = $directories; bytes = $bytes }
}

function Get-ProcessTreeIds {
  param(
    [Parameter(Mandatory = $true)][uint32]$RootProcessId,
    [Parameter(Mandatory = $true)][object[]]$Processes
  )

  $ids = [System.Collections.Generic.HashSet[uint32]]::new()
  [void]$ids.Add($RootProcessId)
  $changed = $true
  while ($changed) {
    $changed = $false
    foreach ($process in $Processes) {
      if ($ids.Contains([uint32]$process.ParentProcessId) -and -not $ids.Contains([uint32]$process.ProcessId)) {
        [void]$ids.Add([uint32]$process.ProcessId)
        $changed = $true
      }
    }
  }
  return ,$ids
}

function Measure-Average {
  param([object[]]$Values)
  if ($Values.Count -eq 0) { return 0 }
  return [math]::Round((($Values | Measure-Object -Average).Average), 2)
}

function Measure-Maximum {
  param([object[]]$Values)
  if ($Values.Count -eq 0) { return 0 }
  return [math]::Round((($Values | Measure-Object -Maximum).Maximum), 2)
}

function Get-SampleValues {
  param(
    [object[]]$Samples,
    [Parameter(Mandatory = $true)][string]$Property
  )

  return @(
    foreach ($sample in $Samples) {
      $value = $sample.PSObject.Properties[$Property]
      if ($null -ne $value) { [double]$value.Value }
    }
  )
}

$resolvedWorktree = (Resolve-Path -LiteralPath $WorktreeRoot).Path
$resolvedEvidence = [IO.Path]::GetFullPath($EvidenceDirectory)
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$relativeEvidence = [IO.Path]::GetRelativePath($repositoryRoot, $resolvedEvidence)
if ($relativeEvidence.StartsWith('..') -or [IO.Path]::IsPathRooted($relativeEvidence)) {
  throw "Evidence directory must be inside the repository: $resolvedEvidence"
}

$probePath = Join-Path $resolvedEvidence "$Label-probe.tmp"
$previousNativePreference = $PSNativeCommandUseErrorActionPreference
$PSNativeCommandUseErrorActionPreference = $false
$ignoreEvidence = & git -C $repositoryRoot check-ignore -v -- $probePath 2>$null
$ignoreExitCode = $LASTEXITCODE
$PSNativeCommandUseErrorActionPreference = $previousNativePreference
if ($ignoreExitCode -ne 0) {
  throw "Evidence directory is not ignored by Git: $resolvedEvidence"
}

[void](New-Item -ItemType Directory -Path $resolvedEvidence -Force)
$standardOutputPath = Join-Path $resolvedEvidence "$Label.ndjson"
$standardErrorPath = Join-Path $resolvedEvidence "$Label.stderr.log"
$samplesPath = Join-Path $resolvedEvidence "$Label.samples.csv"
$summaryPath = Join-Path $resolvedEvidence "$Label.measurement.json"

foreach ($target in @($standardOutputPath, $standardErrorPath, $samplesPath, $summaryPath)) {
  if (Test-Path -LiteralPath $target) {
    throw "Refusing to overwrite existing evidence: $target"
  }
}

$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
$pnpmCliCandidates = @(
  $(if ($env:APPDATA) { Join-Path $env:APPDATA 'npm/node_modules/pnpm/bin/pnpm.mjs' }),
  (Join-Path (Split-Path $nodeExecutable -Parent) 'node_modules/pnpm/bin/pnpm.mjs'),
  (Join-Path (Split-Path $nodeExecutable -Parent) 'node_modules/corepack/dist/pnpm.js')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$pnpmCli = $pnpmCliCandidates | Select-Object -First 1
if (-not $pnpmCli) {
  throw 'Unable to locate the pnpm JavaScript entry point.'
}

$arguments = @(
  $pnpmCli,
  'install',
  '--frozen-lockfile',
  '--offline',
  '--config.strictDepBuilds=false',
  '--reporter=ndjson'
)
if ($EnableGlobalVirtualStore) {
  $arguments += '--config.enableGlobalVirtualStore=true'
}

$nodeModulesPath = Join-Path $resolvedWorktree 'node_modules'
$beforeTree = Get-TreeStatistics -Path $nodeModulesPath
$samples = [System.Collections.Generic.List[object]]::new()
$process = $null
$exitCode = $null
$startedAt = (Get-Date).ToUniversalTime()

$duration = Measure-Command {
  $process = Start-Process -FilePath $nodeExecutable `
    -ArgumentList $arguments `
    -WorkingDirectory $resolvedWorktree `
    -RedirectStandardOutput $standardOutputPath `
    -RedirectStandardError $standardErrorPath `
    -WindowStyle Hidden `
    -PassThru

  do {
    Start-Sleep -Seconds $SampleIntervalSeconds
    $process.Refresh()

    try {
      $processRows = @(Get-CimInstance Win32_Process -ErrorAction Stop)
      $treeIds = Get-ProcessTreeIds -RootProcessId ([uint32]$process.Id) -Processes $processRows
      $perfRows = @(Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -ErrorAction Stop)
      $pnpmRows = @($perfRows | Where-Object { $treeIds.Contains([uint32]$_.IDProcess) })
      $defenderRows = @($perfRows | Where-Object { $_.Name -eq 'MsMpEng' })
      $disk = Get-CimInstance Win32_PerfFormattedData_PerfDisk_LogicalDisk `
        -Filter "Name='$([IO.Path]::GetPathRoot($resolvedWorktree).TrimEnd('\'))'" `
        -ErrorAction Stop

      $samples.Add([pscustomobject]@{
          timestampUtc = (Get-Date).ToUniversalTime().ToString('o')
          pnpmProcessCount = $pnpmRows.Count
          pnpmCpuPercent = [double](($pnpmRows | Measure-Object PercentProcessorTime -Sum).Sum ?? 0)
          pnpmReadBytesPerSecond = [double](($pnpmRows | Measure-Object IOReadBytesPersec -Sum).Sum ?? 0)
          pnpmWriteBytesPerSecond = [double](($pnpmRows | Measure-Object IOWriteBytesPersec -Sum).Sum ?? 0)
          pnpmWorkingSetBytes = [double](($pnpmRows | Measure-Object WorkingSetPrivate -Sum).Sum ?? 0)
          defenderCpuPercent = [double](($defenderRows | Measure-Object PercentProcessorTime -Sum).Sum ?? 0)
          defenderReadBytesPerSecond = [double](($defenderRows | Measure-Object IOReadBytesPersec -Sum).Sum ?? 0)
          defenderWriteBytesPerSecond = [double](($defenderRows | Measure-Object IOWriteBytesPersec -Sum).Sum ?? 0)
          diskBusyPercent = [double]($disk.PercentDiskTime ?? 0)
          diskReadBytesPerSecond = [double]($disk.DiskReadBytesPersec ?? 0)
          diskWriteBytesPerSecond = [double]($disk.DiskWriteBytesPersec ?? 0)
        })
    } catch {
      $samples.Add([pscustomobject]@{
          timestampUtc = (Get-Date).ToUniversalTime().ToString('o')
          samplingError = $_.Exception.Message
        })
    }
  } while (-not $process.HasExited)

  $process.WaitForExit()
  $process.Refresh()
  $exitCode = $process.ExitCode
}

$finishedAt = (Get-Date).ToUniversalTime()
$afterTree = Get-TreeStatistics -Path $nodeModulesPath
$samples | Export-Csv -LiteralPath $samplesPath -NoTypeInformation -Encoding utf8

$validSamples = @(
  $samples | Where-Object { $null -eq $_.PSObject.Properties['samplingError'] }
)
$summary = [ordered]@{
  schemaVersion = 1
  label = $Label
  worktree = $resolvedWorktree
  globalVirtualStore = [bool]$EnableGlobalVirtualStore
  pnpmArguments = @($arguments | Select-Object -Skip 1)
  startedAtUtc = $startedAt.ToString('o')
  finishedAtUtc = $finishedAt.ToString('o')
  elapsedSeconds = [math]::Round($duration.TotalSeconds, 3)
  exitCode = $exitCode
  sampleIntervalSeconds = $SampleIntervalSeconds
  sampleCount = $samples.Count
  validSampleCount = $validSamples.Count
  treeBefore = $beforeTree
  treeAfter = $afterTree
  treeDelta = [ordered]@{
    files = $afterTree.files - $beforeTree.files
    directories = $afterTree.directories - $beforeTree.directories
    bytes = $afterTree.bytes - $beforeTree.bytes
  }
  activity = [ordered]@{
    pnpmCpuAveragePercent = Measure-Average (Get-SampleValues $validSamples 'pnpmCpuPercent')
    pnpmCpuPeakPercent = Measure-Maximum (Get-SampleValues $validSamples 'pnpmCpuPercent')
    pnpmReadAverageBytesPerSecond = Measure-Average (Get-SampleValues $validSamples 'pnpmReadBytesPerSecond')
    pnpmWriteAverageBytesPerSecond = Measure-Average (Get-SampleValues $validSamples 'pnpmWriteBytesPerSecond')
    defenderCpuAveragePercent = Measure-Average (Get-SampleValues $validSamples 'defenderCpuPercent')
    defenderCpuPeakPercent = Measure-Maximum (Get-SampleValues $validSamples 'defenderCpuPercent')
    defenderReadAverageBytesPerSecond = Measure-Average (Get-SampleValues $validSamples 'defenderReadBytesPerSecond')
    defenderWriteAverageBytesPerSecond = Measure-Average (Get-SampleValues $validSamples 'defenderWriteBytesPerSecond')
    diskBusyAveragePercent = Measure-Average (Get-SampleValues $validSamples 'diskBusyPercent')
    diskBusyPeakPercent = Measure-Maximum (Get-SampleValues $validSamples 'diskBusyPercent')
    diskReadAverageBytesPerSecond = Measure-Average (Get-SampleValues $validSamples 'diskReadBytesPerSecond')
    diskWriteAverageBytesPerSecond = Measure-Average (Get-SampleValues $validSamples 'diskWriteBytesPerSecond')
  }
  evidence = [ordered]@{
    ndjson = [IO.Path]::GetFileName($standardOutputPath)
    stderr = [IO.Path]::GetFileName($standardErrorPath)
    samples = [IO.Path]::GetFileName($samplesPath)
    gitIgnoreRule = ($ignoreEvidence -join ' ')
  }
}

$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath -Encoding utf8
$summary | ConvertTo-Json -Depth 8
if ($exitCode -ne 0) {
  throw "pnpm install failed with exit code $exitCode; evidence was retained."
}
