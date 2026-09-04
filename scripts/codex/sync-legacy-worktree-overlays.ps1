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

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    $output = @(& git -C $WorkingDirectory @Arguments)
    if ($LASTEXITCODE -ne 0) { throw "git -C $WorkingDirectory $($Arguments -join ' ') failed" }
    return ($output -join [Environment]::NewLine).Trim()
}

function Parse-WorktreeList {
    param([Parameter(Mandatory = $true)][string]$Source)
    $entries = @()
    foreach ($block in ($Source -split '\r?\n\r?\n')) {
        $lines = $block -split '\r?\n'
        $pathLine = $lines | Where-Object { $_.StartsWith('worktree ') } | Select-Object -First 1
        $headLine = $lines | Where-Object { $_.StartsWith('HEAD ') } | Select-Object -First 1
        if (-not $pathLine -or -not $headLine) { continue }
        $branchLine = $lines | Where-Object { $_.StartsWith('branch ') } | Select-Object -First 1
        $entries += [pscustomobject]@{
            path = [IO.Path]::GetFullPath($pathLine.Substring(9))
            head = $headLine.Substring(5)
            branch = if ($branchLine) { $branchLine.Substring(7) } else { $null }
        }
    }
    return $entries
}

function Get-TreeHash {
    param([Parameter(Mandatory = $true)][string]$Directory)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $lines = @()
        foreach ($file in @(Get-ChildItem -LiteralPath $Directory -Recurse -File | Sort-Object FullName)) {
            $relative = $file.FullName.Substring($Directory.Length + 1).Replace('\', '/')
            $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            $lines += "$relative`n$hash"
        }
        return -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($lines -join "`n"))) | ForEach-Object { $_.ToString('x2') })
    }
    finally { $sha.Dispose() }
}

function Write-AtomicJson {
    param([Parameter(Mandatory = $true)][string]$Target, [Parameter(Mandatory = $true)][object]$Value)
    [void](New-Item -ItemType Directory -Path (Split-Path -Parent $Target) -Force)
    $temporary = "$Target.$PID.tmp"
    [IO.File]::WriteAllText($temporary, (($Value | ConvertTo-Json -Depth 12) + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporary -Destination $Target -Force
}

try {
    $hint = if ($RepoRoot) { [IO.Path]::GetFullPath($RepoRoot) } else { [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')) }
    $root = [IO.Path]::GetFullPath((Invoke-Git -WorkingDirectory $hint -Arguments @('rev-parse', '--show-toplevel')))
    $commonRaw = Invoke-Git -WorkingDirectory $root -Arguments @('rev-parse', '--git-common-dir')
    $common = if ([IO.Path]::IsPathRooted($commonRaw)) { [IO.Path]::GetFullPath($commonRaw) } else { [IO.Path]::GetFullPath((Join-Path $root $commonRaw)) }
    $home = [IO.Path]::GetFullPath([IO.Path]::GetDirectoryName($common)).TrimEnd('\')
    $pool = Get-CanonicalPath (Join-Path $home 'runtime/wt')
    $skill = Join-Path $home '.agents/skills/schedule-project-guardrails'
    $skillHash = Get-TreeHash $skill
    $entries = @(Parse-WorktreeList (Invoke-Git -WorkingDirectory $root -Arguments @('worktree', 'list', '--porcelain')))
    $records = @()
    $created = 0
    $removed = 0
    foreach ($entry in $entries) {
        $path = [IO.Path]::GetFullPath($entry.path)
        $canonical = Get-CanonicalPath $path
        if ($canonical -eq (Get-CanonicalPath $home) -or $canonical.StartsWith("$pool\")) { continue }
        $agentsPath = Join-Path $path 'AGENTS.md'
        $overridePath = Join-Path $path 'AGENTS.override.md'
        $agents = if (Test-Path -LiteralPath $agentsPath -PathType Leaf) { Get-Content -LiteralPath $agentsPath -Raw } else { '' }
        $hasCurrentRoute = $agents.Contains('DEPENDENCY_MODE=REUSE_ONLY') -and $agents.Contains('$schedule-project-guardrails')
        if ($hasCurrentRoute) {
            if (Test-Path -LiteralPath $overridePath -PathType Leaf) {
                $existing = Get-Content -LiteralPath $overridePath -Raw
                if ($existing.Contains('Schedule legacy worktree overlay')) {
                    Remove-Item -LiteralPath $overridePath -Force
                    $removed += 1
                }
            }
            continue
        }
        $overlay = @(
            '# Schedule legacy worktree overlay',
            'Schedule project: medical-staff-scheduling-system.',
            'DEPENDENCY_MODE=REUSE_ONLY.',
            '不得安装依赖；从 canonical project root 读取正式 $schedule-project-guardrails Skill。',
            '开始任务前必须 acquire 独占 warm slot；不得在历史 worktree 重建依赖。',
            "Canonical Skill tree hash: $skillHash."
        ) -join [Environment]::NewLine
        [IO.File]::WriteAllText($overridePath, $overlay + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
        $exclude = Invoke-Git -WorkingDirectory $path -Arguments @('rev-parse', '--git-path', 'info/exclude')
        $exclude = if ([IO.Path]::IsPathRooted($exclude)) { $exclude } else { [IO.Path]::GetFullPath((Join-Path $path $exclude)) }
        $excludeLines = if (Test-Path -LiteralPath $exclude -PathType Leaf) { Get-Content -LiteralPath $exclude } else { @() }
        if ($excludeLines -notcontains 'AGENTS.override.md') {
            [IO.File]::AppendAllText($exclude, "AGENTS.override.md$([Environment]::NewLine)", [Text.UTF8Encoding]::new($false))
        }
        $ignored = Invoke-Git -WorkingDirectory $path -Arguments @('check-ignore', '-q', '--no-index', 'AGENTS.override.md')
        $created += 1
        $records += [pscustomobject]@{ path = $path; head = $entry.head; branch = $entry.branch; overlayVersion = 1; canonicalSkillTreeHash = $skillHash; ignored = ($ignored -eq '') }
    }
    $statePath = Join-Path $home 'runtime/codex/state/legacy-overlays.json'
    Write-AtomicJson -Target $statePath -Value ([ordered]@{ schemaVersion = 1; generatedAt = (Get-Date).ToUniversalTime().ToString('o'); canonicalProjectHome = $home; canonicalSkillTreeHash = $skillHash; overlays = $records })
    Write-Output "OVERLAYS_CREATED=$created"
    Write-Output "OVERLAYS_REMOVED=$removed"
    Write-Output "STATE_PATH=$statePath"
    Write-Output "CANONICAL_SKILL_TREE_HASH=$skillHash"
}
catch {
    Write-Error $_
    exit 2
}
