#!/usr/bin/env bun
/**
 * pagedmd postinstall script
 *
 * Checks for WeasyPrint v68.0+ and offers to install it if not found.
 * WeasyPrint is required for PDF generation.
 */

import { spawn, spawnSync } from "child_process";

const MIN_VERSION = "68.0";
const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function log(message: string, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function logSuccess(message: string) {
  log(`✓ ${message}`, COLORS.green);
}

function logWarning(message: string) {
  log(`⚠ ${message}`, COLORS.yellow);
}

function logError(message: string) {
  log(`✗ ${message}`, COLORS.red);
}

function logInfo(message: string) {
  log(`ℹ ${message}`, COLORS.cyan);
}

/**
 * Check if WeasyPrint is installed with required version
 */
async function checkWeasyPrint(): Promise<{ installed: boolean; version?: string }> {
  return new Promise((resolve) => {
    const proc = spawn("weasyprint", ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    proc.stdout.on("data", (data) => (output += data.toString()));
    proc.stderr.on("data", (data) => (output += data.toString()));

    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({ installed: false });
        return;
      }

      const match = output.match(/(\d+)\.(\d+)/);
      if (match && match[1] && match[2]) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        const version = `${major}.${minor}`;
        const meetsVersion = major > 68 || (major === 68 && minor >= 0);

        if (meetsVersion) {
          resolve({ installed: true, version });
        } else {
          resolve({ installed: false, version });
        }
      } else {
        resolve({ installed: false });
      }
    });

    proc.on("error", () => resolve({ installed: false }));
  });
}

/**
 * Check if pip is available
 */
function checkPip(): boolean {
  const result = spawnSync("pip", ["--version"], { stdio: "ignore" });
  if (result.status === 0) return true;

  const result3 = spawnSync("pip3", ["--version"], { stdio: "ignore" });
  return result3.status === 0;
}

/**
 * Install WeasyPrint using pip
 */
async function installWeasyPrint(): Promise<boolean> {
  logInfo("Installing WeasyPrint v68.0+...");

  const pipCmd = spawnSync("pip", ["--version"], { stdio: "ignore" }).status === 0 ? "pip" : "pip3";

  return new Promise((resolve) => {
    const proc = spawn(pipCmd, ["install", `weasyprint>=${MIN_VERSION}`], {
      stdio: "inherit",
    });

    proc.on("close", (code) => {
      resolve(code === 0);
    });

    proc.on("error", () => resolve(false));
  });
}

/**
 * Main postinstall logic
 */
async function main() {
  console.log("");
  log(`${COLORS.bold}pagedmd postinstall${COLORS.reset}`);
  console.log("Checking PDF engine dependencies...\n");

  // Check for WeasyPrint
  const weasyPrint = await checkWeasyPrint();

  if (weasyPrint.installed) {
    logSuccess(`WeasyPrint ${weasyPrint.version} is installed`);
    console.log("");
    return;
  }

  if (weasyPrint.version) {
    logWarning(`WeasyPrint ${weasyPrint.version} found but v${MIN_VERSION}+ is required`);
  } else {
    logWarning("WeasyPrint is not installed");
  }

  // Check if pip is available
  if (!checkPip()) {
    logError("pip is not available - cannot auto-install WeasyPrint");
    console.log("");
    logInfo("Please install WeasyPrint manually:");
    console.log(`  pip install 'weasyprint>=${MIN_VERSION}'`);
    console.log("");
    logInfo("Or install pip first:");
    console.log("  - macOS: brew install python");
    console.log("  - Ubuntu/Debian: sudo apt install python3-pip");
    console.log("  - Windows: https://pip.pypa.io/en/stable/installation/");
    console.log("");
    // Don't fail the install, just warn
    return;
  }

  // Auto-install WeasyPrint
  console.log("");
  const success = await installWeasyPrint();

  if (success) {
    const verify = await checkWeasyPrint();
    if (verify.installed) {
      console.log("");
      logSuccess(`WeasyPrint ${verify.version} installed successfully`);
    } else {
      logWarning("WeasyPrint installed but verification failed");
      logInfo("Try running: weasyprint --version");
    }
  } else {
    logError("Failed to install WeasyPrint");
    console.log("");
    logInfo("Please install manually:");
    console.log(`  pip install 'weasyprint>=${MIN_VERSION}'`);
    console.log("");
    logInfo("For system dependencies, see:");
    console.log("  https://doc.courtbouillon.org/weasyprint/stable/first_steps.html");
  }

  console.log("");
}

main().catch((err) => {
  console.error("Postinstall error:", err);
  // Don't fail the npm install
});
