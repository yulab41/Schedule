$ErrorActionPreference='Stop'
$PSNativeCommandUseErrorActionPreference=$true
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'manage-worktree-pool.ps1'),[ref]$tokens,[ref]$errors)
foreach($f in $ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst]},$false)){ . ([scriptblock]::Create($f.Extent.Text)) }
$fixture=Join-Path $PSScriptRoot ('../../runtime/codex/fixtures/handoff-'+[guid]::NewGuid())
$fixture=[IO.Path]::GetFullPath($fixture)
New-Item -ItemType Directory -Path $fixture -Force | Out-Null
$slot=[pscustomobject]@{path=$fixture;head=('a'*40);branch=$null;detached=$true;lease=$null;process=[pscustomobject]@{known=$true;count=0};metadata=[pscustomobject]@{role='general';status='free'};paths=[pscustomobject]@{slotKey='fixture';lease=(Join-Path $fixture 'lease.json');marker=(Join-Path $fixture 'slot.json')}}
$Role='general';$Owner='owner';$SessionId='session';$TaskId='task';$Profile=$null;$Path=$null;$ReconciliationHandoff=$false
function Assert-PoolBoundary {}
function Ensure-LocalPoolConfig {}
function Get-ManagedSlots { $slot.lease=Read-Lease $slot.paths.lease; @($slot) }
function Test-CleanWorktree { $true }
function Test-StandaloneNodeModules { $true }
function Resolve-BaseCommit { 'b'*40 }
function Initialize-TaskBranch { [pscustomobject]@{head=('b'*40);name='refs/heads/codex/fixture'} }
function Invoke-Git { [pscustomobject]@{ExitCode=0;Output=''} }
function Get-DependencyCheck { param($WorktreePath,$Token); if($Token){[pscustomobject]@{taskStatus='BLOCKED_DEPENDENCY_INSTALL_REQUIRED';dependenciesReused=$false;dependencyFingerprint=('c'*64);reasons=@('health:workspace-link-missing')}}else{[pscustomobject]@{taskStatus='READY_REUSE';dependenciesReused=$true;dependencyFingerprint=('a'*64)}} }
try {
$r=Acquire-Slot
if($r.taskStatus -ne 'NEEDS_RECONCILIATION'){throw "Expected NEEDS_RECONCILIATION, got $($r.taskStatus)"}
$l=Read-Lease $slot.paths.lease
if(-not $l -or $l.token -ne $r.data.leaseToken -or $l.owner -ne $Owner -or $l.sessionId -ne $SessionId -or $l.taskId -ne $TaskId){throw 'lease lost or rebound'}
if($l.baseSha -ne ('b'*40) -or $l.dependencyFingerprint -ne ('c'*64)){throw 'wrong target identity'}
$before=Get-Content -Raw $slot.paths.lease
$Owner='competitor';$SessionId='other';$TaskId='other'
$r2=Acquire-Slot
if($r2.taskStatus -ne 'POOL_BUSY' -or (Get-Content -Raw $slot.paths.lease) -ne $before){throw 'concurrent acquire overwrote lease'}
$Owner='owner';$SessionId='session';$TaskId='task';$LeaseToken=$l.token;$Path=$slot.path
function Assert-ManagedSlot { $slot.lease=Read-Lease $slot.paths.lease; $slot }
function Get-ChildProcessEvidence { [pscustomobject]@{known=$true;count=0} }
function Get-GitValue { 'b'*40 }
$heartbeat=Heartbeat-Slot
if($heartbeat.taskStatus -ne 'NEEDS_RECONCILIATION'){throw 'Heartbeat advertised incomplete environment as healthy'}
$released=Release-Slot
if($released.taskStatus -ne 'QUARANTINED_RECONCILIATION' -or -not $released.data.released){throw 'Incomplete environment not quarantined on release'}
if(Test-Path -LiteralPath $slot.paths.lease){throw 'Release left lease behind'}
$metadata=Get-Content -Raw $slot.paths.marker | ConvertFrom-Json
if($metadata.status -ne 'quarantined-dependency'){throw 'Failure slot advertised free'}
Write-Output 'HANDOFF_FIXTURE_PASS'
} finally { if(-not $fixture.StartsWith([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../runtime/codex/fixtures/')))){throw 'unsafe fixture cleanup'}; Remove-Item -LiteralPath $fixture -Recurse -Force }
