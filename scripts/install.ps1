# pagedmd Installation Script for Windows 11
# This script installs Bun and pagedmd globally for end users

$ErrorActionPreference = "Stop"

# Configuration
$PAGEDMD_REPO = "https://github.com/dimm-city/pagedmd.git"
$PAGEDMD_PACKAGE = "@dimm-city/pagedmd"

# Color output functions
function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host ">>> $Message" -ForegroundColor Yellow
}

# Check and install Bun
function Install-Bun {
    Write-Step "Checking for Bun..."

    try {
        $bunVersion = bun --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Bun is already installed (version $bunVersion)"
            return $true
        }
    } catch {
        # Bun not found, continue to installation
    }

    Write-Info "Bun not found. Installing now..."
    Write-Info "This will download and install Bun from bun.sh"

    try {
        irm bun.sh/install.ps1 | iex

        # Refresh PATH in current session
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

        # Verify installation
        $bunVersion = bun --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Bun installed successfully!"
            return $true
        } else {
            Write-Error "Installation completed but Bun is not available yet"
            Write-Info "Please close this window and open a new PowerShell window, then run this script again"
            return $false
        }
    } catch {
        Write-Error "Failed to install Bun: $_"
        Write-Info "Visit https://bun.sh for manual installation instructions"
        return $false
    }
}

# Install pagedmd globally
function Install-Pagedmd {
    Write-Step "Installing pagedmd..."
    Write-Info "This may take a minute..."

    try {
        # Install from npm registry (when published) or from GitHub
        # For now, using GitHub installation
        Write-Info "Installing from GitHub repository..."
        bun add -g $PAGEDMD_REPO

        if ($LASTEXITCODE -eq 0) {
            Write-Success "pagedmd installed successfully!"
            return $true
        } else {
            Write-Error "Failed to install pagedmd"
            return $false
        }
    } catch {
        Write-Error "Failed to install pagedmd: $_"
        return $false
    }
}

# Verify installation
function Test-Installation {
    Write-Step "Verifying installation..."

    try {
        $version = pagedmd --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "pagedmd is working! (version $version)"
            return $true
        } else {
            Write-Error "pagedmd command not found"
            Write-Info "You may need to restart your terminal"
            return $false
        }
    } catch {
        Write-Error "pagedmd command not found"
        Write-Info "You may need to restart your terminal"
        return $false
    }
}

# Main installation flow
function Main {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "  pagedmd Installation" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host ""
    Write-Info "This will install pagedmd globally on your system"
    Write-Host ""

    # Step 1: Install Bun
    if (-not (Install-Bun)) {
        Write-Error "Installation failed. Please try again."
        exit 1
    }

    # Step 2: Install pagedmd globally
    if (-not (Install-Pagedmd)) {
        Write-Error "Installation failed. Please try again."
        exit 1
    }

    # Step 3: Verify
    if (-not (Test-Installation)) {
        Write-Info "Installation completed but verification failed"
        Write-Info "Try closing this window and running 'pagedmd --version' in a new terminal"
        exit 0
    }

    # Success!
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Installation Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Success "pagedmd is ready to use!"
    Write-Host ""
    Write-Info "Quick Start:"
    Write-Host "  1. Create a folder with your markdown files" -ForegroundColor White
    Write-Host "  2. Open PowerShell in that folder" -ForegroundColor White
    Write-Host "  3. Run:" -ForegroundColor White
    Write-Host ""
    Write-Host "     pagedmd build" -ForegroundColor Cyan
    Write-Host ""
    Write-Info "This will create a PDF from your markdown files."
    Write-Host ""
    Write-Info "For more options: pagedmd --help"
    Write-Host ""
}

# Run main installation
Main
