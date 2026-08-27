# Windows shell fail-fast

PowerShell's `$ErrorActionPreference = 'Stop'` alone does not stop after a native `node`, `pnpm`, or
`git` non-zero exit. Multi-command PowerShell tool calls must also set:

```powershell
$PSNativeCommandUseErrorActionPreference = $true
```

Alternatively split commands into separate calls. Do not accept a later successful command as the
status of a chain whose earlier command failed.
