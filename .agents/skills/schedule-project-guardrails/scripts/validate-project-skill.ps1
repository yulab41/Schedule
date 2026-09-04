[CmdletBinding()]
param(
    [string]$RepoRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

function Invoke-GitRead {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,
        [int[]]$AllowedExitCodes = @(0)
    )

    $preference = Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
    $raw = @()
    $exitCode = -1
    try {
        $PSNativeCommandUseErrorActionPreference = $false
        Push-Location -LiteralPath $WorkingDirectory
        try {
            $raw = @(& git @Arguments 2>&1)
            $exitCode = $LASTEXITCODE
        }
        finally {
            Pop-Location
        }
    }
    finally {
        if ($null -ne $preference) {
            $PSNativeCommandUseErrorActionPreference = $preference.Value
        }
        else {
            Remove-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Local -ErrorAction SilentlyContinue
        }
    }

    if ($AllowedExitCodes -notcontains $exitCode) {
        $detail = ($raw | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
        throw "git $($Arguments -join ' ') failed with exit code $exitCode$(if ($detail) { ": $detail" })"
    }

    [pscustomobject]@{
        ExitCode = $exitCode
        Output = (($raw | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine).TrimEnd()
    }
}

function Resolve-RepositoryRoot {
    if ($RepoRoot) {
        return [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $RepoRoot).Path)
    }
    $result = Invoke-GitRead -Arguments @('rev-parse', '--show-toplevel') -WorkingDirectory (Get-Location).Path
    [System.IO.Path]::GetFullPath($result.Output.Trim())
}

try {
    $root = Resolve-RepositoryRoot
    $gitRoot = Invoke-GitRead -Arguments @('rev-parse', '--show-toplevel') -WorkingDirectory $root
    if (-not [System.IO.Path]::GetFullPath($gitRoot.Output.Trim()).Equals(
        $root,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw 'RepoRoot is not the Git top level'
    }

    $package = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
    if ($package.name -ne 'medical-staff-scheduling-system' -or $package.private -ne $true) {
        throw 'package.json does not identify the private Schedule repository'
    }

    $skillRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
    $expectedRoot = [System.IO.Path]::GetFullPath(
        (Join-Path $root '.agents/skills/schedule-project-guardrails')
    )
    if (-not $skillRoot.Equals($expectedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'skill is outside the required repository-local path'
    }

    $requiredFiles = @(
        'SKILL.md',
        'agents/openai.yaml',
        'references/task-levels.md',
        'references/worktree-and-bootstrap.md',
        'references/dependency-lifecycle.md',
        'references/multi-parallel-workflow.md',
        'references/miniprogram.md',
        'references/debugging.md',
        'references/testing-and-evidence.md',
        'references/release-candidate.md',
        'references/production.md',
        'references/known-pitfalls.md',
        'scripts/inspect-task-context.ps1',
        'scripts/check-worktree-safety.ps1',
        'scripts/validate-project-skill.ps1'
    )
    foreach ($relativePath in $requiredFiles) {
        if (-not (Test-Path -LiteralPath (Join-Path $skillRoot $relativePath) -PathType Leaf)) {
            throw "missing required skill file: $relativePath"
        }
    }

    $skillPath = Join-Path $skillRoot 'SKILL.md'
    $skillContent = Get-Content -LiteralPath $skillPath -Raw
    $frontMatter = [regex]::Match($skillContent, '\A---\r?\n(?<body>.*?)\r?\n---\r?\n', 'Singleline')
    if (-not $frontMatter.Success) {
        throw 'SKILL.md has invalid YAML front matter boundaries'
    }
    if ($frontMatter.Groups['body'].Value -notmatch '(?m)^name:\s+schedule-project-guardrails\s*$') {
        throw 'SKILL.md name does not match the folder'
    }
    if ($frontMatter.Groups['body'].Value -notmatch '(?m)^description:\s+\S.+$') {
        throw 'SKILL.md requires a one-line description'
    }
    $frontMatterBody = $frontMatter.Groups['body'].Value
    $frontMatterKeys = @(
        [regex]::Matches($frontMatterBody, '(?m)^(?<key>[A-Za-z0-9-]+):') |
            ForEach-Object { $_.Groups['key'].Value }
    )
    $allowedFrontMatterKeys = @('name', 'description', 'license', 'allowed-tools', 'metadata')
    foreach ($frontMatterKey in $frontMatterKeys) {
        if ($allowedFrontMatterKeys -notcontains $frontMatterKey) {
            throw "SKILL.md contains an unsupported front matter key: $frontMatterKey"
        }
    }
    $descriptionMatch = [regex]::Match($frontMatterBody, '(?m)^description:\s+(?<value>.+)$')
    $description = $descriptionMatch.Groups['value'].Value.Trim().Trim('"', "'")
    if ($description.Length -gt 1024 -or $description.Contains('<') -or $description.Contains('>') -or
        $description.StartsWith('[TODO:')) {
        throw 'SKILL.md description violates the skill front matter constraints'
    }
    if ($skillContent -match '(?m)^\s{0,3}\[TODO:[^\r\n]*\]\s*$') {
        throw 'SKILL.md contains an unfinished TODO placeholder'
    }
    if ($skillContent.Split(@("`r`n", "`n"), [System.StringSplitOptions]::None).Count -gt 140 -or
        [System.Text.Encoding]::UTF8.GetByteCount($skillContent) -gt 8192) {
        throw 'SKILL.md is too large to remain a short router'
    }
    foreach ($requiredToken in @(
        'L0', 'L1', 'L2', 'L3', 'L4', 'SKILL_HASH', '$miniprogram-development',
        '$frontend-design', '$systematic-debugging', '$brainstorming',
        'dependency environment lifecycle', 'DEPENDENCY_MODE=REUSE_ONLY',
        'A conversation boundary is never a dependency invalidation boundary.',
        'POOL_BUSY', 'INSTALL_INVOKED=false', 'dynamic release identity',
        'latest eligible uploaded trial', 'production live release',
        'replaces a repeated Mini safety preamble'
    )) {
        if (-not $skillContent.Contains($requiredToken)) {
            throw "SKILL.md is missing required routing token: $requiredToken"
        }
    }

    $dependencyReference = Get-Content -LiteralPath (Join-Path $skillRoot 'references/dependency-lifecycle.md') -Raw
    foreach ($requiredLifecycleToken in @(
        'A conversation boundary is never a dependency invalidation boundary.',
        'a new or resumed Codex conversation, task, or branch;',
        'switching branches or source SHA',
        '`pnpm-lock.yaml`',
        '`pnpm-workspace.yaml`',
        'every workspace `package.json`',
        'dependency patches and pnpm hooks',
        'Node and pnpm versions',
        'operating system and architecture',
        'dependency-layout pnpm settings',
        'the resolved pnpm store path',
        'When the fingerprint matches and `node_modules` passes its health check:',
        '- skip `pnpm install`;',
        'single-use local authorization record',
        'no install is run.'
    )) {
        if (-not $dependencyReference.Contains($requiredLifecycleToken)) {
            throw "dependency lifecycle reference is missing rule: $requiredLifecycleToken"
        }
    }

    $parallelReference = Get-Content -LiteralPath (Join-Path $skillRoot 'references/multi-parallel-workflow.md') -Raw
    foreach ($requiredPoolToken in @(
        'machine-local Schedule pool',
        'same volume as the repository and pnpm store',
        'atomic create operation',
        'Each active task owns one worktree',
        'POOL_BUSY',
        'maximum no-install concurrency',
        'never create a cold worktree'
    )) {
        if (-not $parallelReference.Contains($requiredPoolToken)) {
            throw "parallel workflow reference is missing rule: $requiredPoolToken"
        }
    }

    $releaseReference = Get-Content -LiteralPath (Join-Path $skillRoot 'references/release-candidate.md') -Raw
    foreach ($requiredReleaseToken in @(
        '## Dynamic release identity',
        'dynamic release identity and baseline freeze',
        'LIVE_RELEASE_VERIFIED=false'
    )) {
        if (-not $releaseReference.Contains($requiredReleaseToken)) {
            throw "release-candidate reference is missing dynamic identity rule: $requiredReleaseToken"
        }
    }

    $miniReference = Get-Content -LiteralPath (Join-Path $skillRoot 'references/miniprogram.md') -Raw
    foreach ($requiredMiniToken in @(
        'UPLOAD_VERSION_ALLOCATION_BLOCKED',
        'UPLOAD_REQUIRED',
        'Mini guardrail capsule',
        'target SHA in the independent clean managed worktree',
        'Never mix main-worktree `dist` with candidate source.',
        'version=local',
        'must not automatically deploy a server',
        'production backup',
        'Web golden images',
        'Xiaomi 14 Android `trial`'
    )) {
        if (-not $miniReference.Contains($requiredMiniToken)) {
            throw "Mini Program reference is missing project invariant: $requiredMiniToken"
        }
    }

    $testingReference = Get-Content -LiteralPath (Join-Path $skillRoot 'references/testing-and-evidence.md') -Raw
    foreach ($requiredEvidenceToken in @(
        'clean parent SHA and clean new SHA',
        'same toolchain, command, profile, environment variables, dependency fingerprint',
        'Disabling a diagnostic feature at runtime does not prove its code was excluded from the bundle.'
    )) {
        if (-not $testingReference.Contains($requiredEvidenceToken)) {
            throw "testing/evidence reference is missing Mini evidence invariant: $requiredEvidenceToken"
        }
    }

    $productionReference = Get-Content -LiteralPath (Join-Path $skillRoot 'references/production.md') -Raw
    if (-not $productionReference.Contains('LIVE_RELEASE_VERIFIED=false')) {
        throw 'production reference is missing the live-release verification boundary'
    }

    $operationsRunbook = Get-Content -LiteralPath (Join-Path $root 'docs/operations/runbook.md') -Raw
    foreach ($requiredBaselineToken in @(
        '## 动态发布身份与基线冻结',
        '最新 `origin/main`',
        '最新合格的已上传体验版',
        'production 当前 live release',
        '`LIVE_RELEASE_VERIFIED=false`'
    )) {
        if (-not $operationsRunbook.Contains($requiredBaselineToken)) {
            throw "operations runbook is missing dynamic baseline rule: $requiredBaselineToken"
        }
    }

    $miniRunbook = Get-Content -LiteralPath (Join-Path $root 'apps/miniprogram/docs/runbooks/miniprogram-ci.md') -Raw
    foreach ($requiredAllocationToken in @(
        '## 体验版版本分配与不可变身份',
        '不得预先指定下一个版本号',
        '版本号 + 源码 SHA + 上传 Manifest',
        '`UPLOAD_VERSION_ALLOCATION_BLOCKED`',
        '`UPLOAD_REQUIRED`',
        '当前消息已明确授权上传',
        '幂等重试'
    )) {
        if (-not $miniRunbook.Contains($requiredAllocationToken)) {
            throw "miniprogram-ci runbook is missing version-allocation rule: $requiredAllocationToken"
        }
    }

    $miniAgents = Get-Content -LiteralPath (Join-Path $root 'apps/miniprogram/AGENTS.md') -Raw
    if ($miniAgents.Contains('record the proposed version instead')) {
        throw 'Mini Program AGENTS.md still preallocates a proposed version without upload authority'
    }
    if (-not $miniAgents.Contains('UPLOAD_REQUIRED')) {
        throw 'Mini Program AGENTS.md is missing the no-upload status boundary'
    }

    $contextInspector = Get-Content -LiteralPath (Join-Path $skillRoot 'scripts/inspect-task-context.ps1') -Raw
    if (-not $contextInspector.Contains('$needsDynamicIdentity')) {
        throw 'context inspector does not route dynamic release identity tasks'
    }

    $knownPitfalls = Get-Content -LiteralPath (Join-Path $skillRoot 'references/known-pitfalls.md') -Raw
    $requiredPitfallIds = @(
        'fresh-worktree-missing-dist',
        'powershell-expected-git-one',
        'nested-worktree-enametoolong',
        'runtime-evidence-dirty-tree',
        'patch-escape-newline-mismatch',
        'ssh-banner-tun-timeout',
        'production-domain-tun-19818',
        'remote-stdin-consumed',
        'browser-smoke-empty-month',
        'diagnostics-off-still-bundled',
        'comparison-environment-drift',
        'main-worktree-mixed-dist',
        'miniprogram-version-local',
        'repeated-1459-linking',
        'duplicate-expensive-gates'
    )
    foreach ($pitfallId in $requiredPitfallIds) {
        if (-not $knownPitfalls.Contains("``$pitfallId``")) {
            throw "known-pitfall index is missing: $pitfallId"
        }
    }

    $metadata = Get-Content -LiteralPath (Join-Path $skillRoot 'agents/openai.yaml') -Raw
    foreach ($pattern in @(
        '(?m)^interface:\s*$',
        '(?m)^\s{2}display_name:\s+"[^"]+"\s*$',
        '(?m)^\s{2}short_description:\s+".{25,64}"\s*$',
        '(?m)^\s{2}default_prompt:\s+"[^\"]*\$schedule-project-guardrails[^\"]*"\s*$',
        '(?m)^policy:\s*$',
        '(?m)^\s{2}allow_implicit_invocation:\s+true\s*$'
    )) {
        if ($metadata -notmatch $pattern) {
            throw "agents/openai.yaml failed metadata pattern: $pattern"
        }
    }

    $markdownFiles = @(Get-ChildItem -LiteralPath $skillRoot -Filter '*.md' -File -Recurse)
    $checkedLinks = 0
    foreach ($markdownFile in $markdownFiles) {
        $content = Get-Content -LiteralPath $markdownFile.FullName -Raw
        if ($content -match '(?m)[ \t]+$') {
            throw "Markdown has trailing whitespace: $($markdownFile.FullName)"
        }
        if ($content -notmatch '(?m)^#\s+\S') {
            throw "Markdown has no level-one heading: $($markdownFile.FullName)"
        }
        foreach ($match in [regex]::Matches($content, '\[[^\]]+\]\((?<target>[^)]+)\)')) {
            $target = $match.Groups['target'].Value.Trim()
            if ($target.StartsWith('#') -or $target -match '^(?i:https?|mailto):') { continue }
            $pathPart = ($target -split '#', 2)[0]
            if (-not $pathPart) { continue }
            $resolvedTarget = [System.IO.Path]::GetFullPath(
                (Join-Path $markdownFile.DirectoryName ([System.Uri]::UnescapeDataString($pathPart)))
            )
            if (-not (Test-Path -LiteralPath $resolvedTarget)) {
                throw "broken Markdown link in $($markdownFile.Name): $target"
            }
            $checkedLinks += 1
        }
    }

    $allSkillText = ($requiredFiles | ForEach-Object {
        Get-Content -LiteralPath (Join-Path $skillRoot $_) -Raw
    }) -join "`n"
    $pinnedSemanticVersion = [regex]::Match(
        $allSkillText,
        '(?<![A-Za-z0-9])\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?(?![A-Za-z0-9])'
    )
    if ($pinnedSemanticVersion.Success) {
        throw "skill contains a permanently pinned semantic version: $($pinnedSemanticVersion.Value)"
    }
    $pinnedSha = [regex]::Match(
        $allSkillText,
        '(?i)(?<![0-9a-f])(?=[0-9a-f]{7,40}(?![0-9a-f]))(?=[0-9a-f]{0,39}[0-9])[0-9a-f]{7,40}(?![0-9a-f])'
    )
    if ($pinnedSha.Success) {
        throw "skill contains a permanently pinned SHA/release value: $($pinnedSha.Value)"
    }
    $pinnedIdentityAssignment = [regex]::Match(
        $allSkillText,
        '(?im)\b(?:MAIN_HEAD|ORIGIN_MAIN_SHA|EVIDENCE_MAIN_SHA|EVIDENCE_TRIAL_VERSION|EVIDENCE_TRIAL_SHA|EVIDENCE_TRIAL_MANIFEST|EVIDENCE_SERVER_RELEASE|LIVE_SERVER_RELEASE|PRODUCTION_LIVE_RELEASE)\s*=\s*(?!<)[^\s;]+'
    )
    if ($pinnedIdentityAssignment.Success) {
        throw "skill contains a permanently pinned release identity: $($pinnedIdentityAssignment.Value)"
    }
    if ($allSkillText -match '(?i)[A-Z]:\\Users\\' -or
        $allSkillText -match '-----BEGIN [A-Z ]*PRIVATE KEY-----') {
        throw 'skill contains a machine-specific user path or private-key material'
    }

    $rootAgents = Get-Content -LiteralPath (Join-Path $root 'AGENTS.md') -Raw
    if (-not $rootAgents.Contains('$schedule-project-guardrails')) {
        throw 'root AGENTS.md does not contain the short repository-skill route'
    }

    $scriptFiles = @(Get-ChildItem -LiteralPath (Join-Path $skillRoot 'scripts') -Filter '*.ps1' -File)
    $forbiddenCommands = @(
        'Add-Content', 'Clear-Content', 'Copy-Item', 'Invoke-RestMethod', 'Invoke-WebRequest',
        'Move-Item', 'New-Item', 'Out-File', 'Remove-Item', 'Rename-Item', 'Set-Content',
        'Set-Item', 'Start-Process', 'Stop-Process', 'docker', 'npm', 'npx', 'pnpm', 'scp',
        'sftp', 'ssh'
    )
    foreach ($scriptFile in $scriptFiles) {
        $tokens = $null
        $parseErrors = $null
        $ast = [System.Management.Automation.Language.Parser]::ParseFile(
            $scriptFile.FullName,
            [ref]$tokens,
            [ref]$parseErrors
        )
        if ($parseErrors.Count -gt 0) {
            $messages = ($parseErrors | ForEach-Object { $_.Message }) -join '; '
            throw "PowerShell syntax error in $($scriptFile.Name): $messages"
        }
        $commands = $ast.FindAll({
            param($node)
            $node -is [System.Management.Automation.Language.CommandAst]
        }, $true)
        foreach ($command in $commands) {
            $commandName = $command.GetCommandName()
            if ($commandName -and $forbiddenCommands -contains $commandName) {
                throw "non-read-only command in $($scriptFile.Name): $commandName"
            }
        }
        $source = Get-Content -LiteralPath $scriptFile.FullName -Raw
        if ($source -match '-----BEGIN [A-Z ]*PRIVATE KEY-----' -or
            $source -match '(?i)password\s*=\s*["''][^"'']+["'']') {
            throw "possible credential material in $($scriptFile.Name)"
        }
    }

    $localOperatorPath = 'runtime/local/production-operator.md'
    $ignoreProbe = Invoke-GitRead -Arguments @('check-ignore', '-q', '--no-index', $localOperatorPath) `
        -WorkingDirectory $root -AllowedExitCodes @(0, 1)
    if ($ignoreProbe.ExitCode -ne 0) {
        throw "$localOperatorPath is not ignored by Git"
    }

    Write-Output "STRUCTURE=PASS; files=$($requiredFiles.Count)"
    Write-Output 'FRONT_MATTER=PASS'
    Write-Output 'OPENAI_YAML=PASS'
    Write-Output "MARKDOWN=PASS; files=$($markdownFiles.Count); links=$checkedLinks"
    Write-Output "POWERSHELL=PASS; files=$($scriptFiles.Count); readOnlyAst=PASS"
    Write-Output "LOCAL_OPERATOR_IGNORE=PASS; path=$localOperatorPath"
    Write-Output 'RESULT=PASS'
}
catch {
    [Console]::Error.WriteLine("[schedule-skill] RESULT=FAIL; $($_.Exception.Message)")
    exit 2
}
