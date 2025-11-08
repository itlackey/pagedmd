[CmdletBinding()]
param(
    [switch]$Quick,
    [switch]$SkipInstall,
    [switch]$RequireShortcut
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Write-Section {
    param([string]$Message)
    Write-Host "`n== $Message ==" -ForegroundColor Cyan
}

function Refresh-UserPath {
    $machine = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = ($machine, $user -join ';').Trim(';')
}

function Invoke-Process {
    param(
        [string]$Command,
        [string[]]$Arguments
    )

    $output = & $Command @Arguments 2>&1
    [pscustomobject]@{
        ExitCode = $LASTEXITCODE
        Output = [string]::Join("`n", $output)
    }
}

function Invoke-Pagedmd {
    param(
        [pscustomobject]$Descriptor,
        [string[]]$Arguments
    )

    $args = @()
    if ($Descriptor.Args) {
        $args += $Descriptor.Args
    }

    if ($Descriptor.UseSeparator -and $null -ne $Arguments -and $Arguments.Count -gt 0) {
        $args += '--'
    }

    if ($null -ne $Arguments) {
        $args += $Arguments
    }

    Invoke-Process -Command $Descriptor.Command -Arguments $args
}

function Get-PagedmdDescriptor {
    $candidates = @(
        [pscustomobject]@{ Display = 'pagedmd'; Command = 'pagedmd'; Args = @(); UseSeparator = $false },
        [pscustomobject]@{ Display = 'bunx @dimm-city/pagedmd'; Command = 'bunx'; Args = @('@dimm-city/pagedmd'); UseSeparator = $false },
        [pscustomobject]@{ Display = 'bun x @dimm-city/pagedmd'; Command = 'bun'; Args = @('x', '@dimm-city/pagedmd'); UseSeparator = $false }
    )

    $globalRoot = Join-Path $env:USERPROFILE '.bun\install\global\node_modules\@dimm-city\pagedmd'
    $sourceCli = Join-Path $globalRoot 'src\cli.ts'
    if (Test-Path $sourceCli) {
        $candidates += [pscustomobject]@{
            Display = "bun run $sourceCli"
            Command = 'bun'
            Args = @('run', $sourceCli)
            UseSeparator = $true
        }
    }

    $distCli = Join-Path $globalRoot 'dist\cli.js'
    if (Test-Path $distCli) {
        $candidates += [pscustomobject]@{
            Display = "bun run $distCli"
            Command = 'bun'
            Args = @('run', $distCli)
            UseSeparator = $true
        }
    }

    foreach ($candidate in $candidates) {
        $result = Invoke-Pagedmd -Descriptor $candidate -Arguments @('--version')
        if ($result.ExitCode -eq 0) {
            $versionLine = ($result.Output -split "`r?`n")[0]
            return [pscustomobject]@{
                Candidate = $candidate
                Version = $versionLine
            }
        }
    }

    throw "Unable to find a working pagedmd command"
}

function Require-Success {
    param(
        [pscustomobject]$Result,
        [string]$FailureMessage
    )

    if ($Result.ExitCode -ne 0) {
        $details = if ([string]::IsNullOrWhiteSpace($Result.Output)) { '' } else { "`n$($Result.Output)" }
        throw "$FailureMessage (exit code $($Result.ExitCode))$details"
    }
}

try {
    Write-Section "pagedmd Windows install test"

    if ($SkipInstall) {
        Write-Host "Skipping install step"
    } else {
    Write-Host "Running install script..."
    $installScript = Resolve-Path (Join-Path $repoRoot 'scripts\install.ps1')
    & $installScript
    }

    Refresh-UserPath

    Write-Section "Checking Bun"
    $bunResult = Invoke-Process -Command 'bun' -Arguments @('--version')
    Require-Success -Result $bunResult -FailureMessage 'Bun is not available after installation'
    Write-Host "Bun version: $($bunResult.Output)"

    Write-Section "Resolving pagedmd command"
    $pagedmd = Get-PagedmdDescriptor
    Write-Host "Using command: $($pagedmd.Candidate.Display)"
    Write-Host "pagedmd version: $($pagedmd.Version)"

    if ($Quick) {
        Write-Host "Quick mode enabled; skipping extended help checks"
    } else {
        Write-Section "Checking pagedmd --help"
        $helpResult = Invoke-Pagedmd -Descriptor $pagedmd.Candidate -Arguments @('--help')
        Require-Success -Result $helpResult -FailureMessage 'pagedmd --help failed'
        if ($helpResult.Output -notmatch 'build' -or $helpResult.Output -notmatch 'preview') {
            throw 'Help output missing expected commands'
        }

        Write-Section "Checking pagedmd build --help"
        $buildResult = Invoke-Pagedmd -Descriptor $pagedmd.Candidate -Arguments @('build', '--help')
        Require-Success -Result $buildResult -FailureMessage 'pagedmd build --help failed'
        if ($buildResult.Output -notmatch '--output' -or $buildResult.Output -notmatch '--format') {
            throw 'Build help output missing expected flags'
        }

        Write-Section "Checking pagedmd preview --help"
        $previewResult = Invoke-Pagedmd -Descriptor $pagedmd.Candidate -Arguments @('preview', '--help')
        Require-Success -Result $previewResult -FailureMessage 'pagedmd preview --help failed'
        if ($previewResult.Output -notmatch '--port') {
            throw 'Preview help output missing expected flags'
        }
    }

    if ($RequireShortcut -and $SkipInstall) {
        Write-Host 'Shortcut verification requested'
    }

    if ($RequireShortcut) {
        Write-Section "Checking desktop shortcut"
        $desktop = [Environment]::GetFolderPath('Desktop')
        if ([string]::IsNullOrWhiteSpace($desktop)) {
            throw 'Desktop path not available for current user'
        }

        $shortcutPath = Join-Path $desktop 'Pagedmd Preview.lnk'
        if (-not (Test-Path $shortcutPath)) {
            throw "Desktop shortcut not found at $shortcutPath"
        }

        Write-Host "Shortcut found at: $shortcutPath"
    } else {
        Write-Host 'Skipping desktop shortcut requirement'
    }

    Write-Section "All checks passed"
}
catch {
    Write-Error $_
    exit 1
}
