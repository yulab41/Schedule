[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Reason,

    [string]$WorktreeRoot = (Get-Location).Path,

    [switch]$Json
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

function Get-CanonicalPath {
    param([Parameter(Mandatory = $true)][string]$Value)
    return [IO.Path]::GetFullPath($Value).TrimEnd('\').ToLowerInvariant()
}

function Get-GitValue {
    param(
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    $value = (& git -C $WorkingDirectory @Arguments).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($value)) {
        throw "git $($Arguments -join ' ') failed for $WorkingDirectory"
    }
    return $value
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Value)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
        return -join ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
    }
    finally {
        $sha.Dispose()
    }
}

function Write-AtomicJson {
    param(
        [Parameter(Mandatory = $true)][string]$Target,
        [Parameter(Mandatory = $true)][object]$Value
    )
    [void](New-Item -ItemType Directory -Path (Split-Path -Parent $Target) -Force)
    $temporary = "$Target.$PID.tmp"
    $encoding = [Text.UTF8Encoding]::new($false)
    [IO.File]::WriteAllText($temporary, (($Value | ConvertTo-Json -Depth 12) + [Environment]::NewLine), $encoding)
    Move-Item -LiteralPath $temporary -Destination $Target -Force
}

try {
    $hint = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
    $worktree = [IO.Path]::GetFullPath((Get-GitValue -WorkingDirectory $hint -Arguments @('rev-parse', '--show-toplevel')))
    $requested = Get-CanonicalPath $WorktreeRoot
    if ($requested -ne (Get-CanonicalPath $worktree)) {
        $worktree = [IO.Path]::GetFullPath((Get-GitValue -WorkingDirectory $WorktreeRoot -Arguments @('rev-parse', '--show-toplevel')))
    }
    $commonRaw = Get-GitValue -WorkingDirectory $worktree -Arguments @('rev-parse', '--git-common-dir')
    $commonDirectory = if ([IO.Path]::IsPathRooted($commonRaw)) {
        [IO.Path]::GetFullPath($commonRaw)
    } else {
        [IO.Path]::GetFullPath((Join-Path $worktree $commonRaw))
    }
    $canonicalProjectHome = [IO.Path]::GetFullPath([IO.Path]::GetDirectoryName($commonDirectory)).TrimEnd('\')
    $canonicalWorktree = Get-CanonicalPath $worktree
    $canonicalCommon = Get-CanonicalPath $commonDirectory
    $targetStore = Get-CanonicalPath (Join-Path $canonicalProjectHome 'runtime/pnpm-store')
    $authorizationRoot = [IO.Path]::GetFullPath((Join-Path $canonicalProjectHome 'runtime/codex/authorizations'))
    $nonce = [guid]::NewGuid().ToString('D')
    $authorizationFile = Join-Path $authorizationRoot "$nonce.json"
    $nodeVersion = (& node --version).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($nodeVersion)) { throw 'Unable to resolve the Node version.' }
    $pnpmVersion = (& pnpm --version).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($pnpmVersion)) { throw 'Unable to resolve the pnpm version.' }
    $installArguments = @(
        'install',
        '--frozen-lockfile',
        '--offline',
        '--config.strictDepBuilds=false',
        "--store-dir=$targetStore"
    )
    $commandJson = @($installArguments) | ConvertTo-Json -Compress
    $commandHash = Get-Sha256 (($canonicalCommon + [Environment]::NewLine + $canonicalWorktree + [Environment]::NewLine + $commandJson))
    $created = (Get-Date).ToUniversalTime()
    $record = [ordered]@{
        schemaVersion = 2
        singleUse = $true
        nonce = $nonce
        createdBy = 'scripts/codex/dependency-maintenance.ps1'
        wrapperPid = $PID
        commonDir = $canonicalCommon
        targetWorktree = $canonicalWorktree
        targetStorePath = $targetStore
        command = [ordered]@{
            cwd = $canonicalWorktree
            args = $installArguments
        }
        commandHash = $commandHash
        lockfileSha256 = (Get-FileHash -LiteralPath (Join-Path $worktree 'pnpm-lock.yaml') -Algorithm SHA256).Hash.ToLowerInvariant()
        nodeVersion = $nodeVersion
        pnpmVersion = $pnpmVersion
        createdAt = $created.ToString('o')
        expiresAt = $created.AddMinutes(15).ToString('o')
        reason = $Reason.Trim()
    }
    Write-AtomicJson -Target $authorizationFile -Value $record
    Write-Output 'DEPENDENCY_MAINTENANCE_AUTHORIZED=true'
    Write-Output 'INSTALL_AUTHORIZED=true'
    try {
        $coreScript = Join-Path $PSScriptRoot 'ensure-worktree-deps.ps1'
        $coreArguments = @(
            '-Mode',
            'DependencyMaintenance',
            '-WorktreeRoot',
            $worktree,
            '-AuthorizationFile',
            $authorizationFile
        )
        if ($Json) { $coreArguments += '-Json' }
        $output = & $coreScript @coreArguments
        $exitCode = $LASTEXITCODE
        $output | ForEach-Object { Write-Output $_ }
        if ($exitCode -ne 0) { exit $exitCode }
    }
    finally {
        foreach ($candidate in @($authorizationFile, "$authorizationFile.claim")) {
            if (Test-Path -LiteralPath $candidate) { Remove-Item -LiteralPath $candidate -Force -ErrorAction SilentlyContinue }
        }
    }
}
catch {
    Write-Error $_
    exit 2
}
