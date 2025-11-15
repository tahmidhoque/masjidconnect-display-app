#!/usr/bin/env node
/**
 * Release Validation Script
 *
 * Validates that a release is properly configured and ready for deployment.
 * Checks artifacts, checksums, version format, and electron-updater compatibility.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const crypto = require("crypto");

const PACKAGE_JSON_PATH = path.join(__dirname, "../package.json");
const DIST_DIR = path.join(__dirname, "../dist");
const SEMVER_REGEX =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

let errors = [];
let warnings = [];

/**
 * Validate semantic version format
 */
function validateVersion(version) {
  if (!SEMVER_REGEX.test(version)) {
    errors.push(
      `Invalid version format: ${version}. Must follow semantic versioning (e.g., 1.0.0)`,
    );
    return false;
  }
  return true;
}

/**
 * Get version from package.json
 */
function getVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8"));
    return packageJson.version;
  } catch (error) {
    errors.push(`Failed to read package.json: ${error.message}`);
    return null;
  }
}

/**
 * Check if dist directory exists
 */
function checkDistDirectory() {
  if (!fs.existsSync(DIST_DIR)) {
    errors.push(`Dist directory does not exist: ${DIST_DIR}`);
    return false;
  }
  return true;
}

/**
 * Calculate SHA256 checksum of a file
 */
function calculateChecksum(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash("sha256");
    hashSum.update(fileBuffer);
    return hashSum.digest("hex");
  } catch (error) {
    return null;
  }
}

/**
 * Validate .deb file
 */
function validateDebFile(filePath) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: "File does not exist" };
    }

    // Check file size (should be > 0)
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return { valid: false, error: "File is empty" };
    }

    // Try to read deb file header (deb files start with "!<arch>")
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    // Check if it's an ar archive (deb files are ar archives)
    const header = buffer.toString("ascii", 0, 8);
    if (!header.startsWith("!<arch>")) {
      warnings.push(
        `File ${path.basename(filePath)} may not be a valid .deb file`,
      );
    }

    return { valid: true, size: stats.size };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Validate required artifacts exist
 */
function validateArtifacts(version) {
  const requiredArtifacts = [
    `masjidconnect-display-${version}-armv7l.deb`,
    `masjidconnect-display-${version}-arm64.deb`,
  ];

  const optionalArtifacts = [
    `masjidconnect-display-${version}-armv7l.tar.gz`,
    `masjidconnect-display-${version}-arm64.tar.gz`,
  ];

  const missing = [];
  const found = [];

  // Check required artifacts
  for (const artifact of requiredArtifacts) {
    const artifactPath = path.join(DIST_DIR, artifact);
    if (fs.existsSync(artifactPath)) {
      found.push(artifact);
      const validation = validateDebFile(artifactPath);
      if (!validation.valid) {
        errors.push(`Invalid artifact ${artifact}: ${validation.error}`);
      }
    } else {
      missing.push(artifact);
    }
  }

  // Check optional artifacts
  for (const artifact of optionalArtifacts) {
    const artifactPath = path.join(DIST_DIR, artifact);
    if (fs.existsSync(artifactPath)) {
      found.push(artifact);
    }
  }

  if (missing.length > 0) {
    errors.push(`Missing required artifacts: ${missing.join(", ")}`);
  }

  return { found, missing };
}

/**
 * Validate checksums
 */
function validateChecksums(version) {
  const artifacts = [
    `masjidconnect-display-${version}-armv7l.deb`,
    `masjidconnect-display-${version}-arm64.deb`,
  ];

  const checksumIssues = [];

  for (const artifact of artifacts) {
    const artifactPath = path.join(DIST_DIR, artifact);
    const checksumPath = path.join(DIST_DIR, `${artifact}.sha256`);

    if (fs.existsSync(artifactPath)) {
      if (fs.existsSync(checksumPath)) {
        // Verify checksum
        const expectedChecksum = fs
          .readFileSync(checksumPath, "utf-8")
          .trim()
          .split(/\s+/)[0];
        const actualChecksum = calculateChecksum(artifactPath);

        if (expectedChecksum !== actualChecksum) {
          checksumIssues.push(`${artifact}: checksum mismatch`);
        }
      } else {
        warnings.push(`No checksum file found for ${artifact}`);
      }
    }
  }

  if (checksumIssues.length > 0) {
    errors.push(`Checksum validation failed: ${checksumIssues.join(", ")}`);
  }

  return checksumIssues.length === 0;
}

/**
 * Check if git tag exists
 */
function checkGitTag(version) {
  const tag = `v${version}`;
  try {
    execSync(`git rev-parse ${tag}`, { stdio: "ignore" });
    return true;
  } catch {
    warnings.push(
      `Git tag ${tag} does not exist. Release may not be properly tagged.`,
    );
    return false;
  }
}

/**
 * Validate release notes exist
 */
function validateReleaseNotes() {
  const changelogPath = path.join(__dirname, "../CHANGELOG.md");
  if (fs.existsSync(changelogPath)) {
    const changelog = fs.readFileSync(changelogPath, "utf-8");
    if (changelog.trim().length === 0) {
      warnings.push("CHANGELOG.md exists but is empty");
    }
    return true;
  } else {
    warnings.push(
      "CHANGELOG.md does not exist. Consider adding release notes.",
    );
    return false;
  }
}

/**
 * Check electron-updater compatibility
 */
function checkElectronUpdaterConfig() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8"));
    const buildConfig = packageJson.build;

    if (!buildConfig) {
      errors.push("No build configuration found in package.json");
      return false;
    }

    if (!buildConfig.publish || !buildConfig.publish.provider) {
      errors.push("No publish provider configured in package.json");
      return false;
    }

    if (buildConfig.publish.provider !== "github") {
      warnings.push(
        `Publish provider is ${buildConfig.publish.provider}, expected 'github'`,
      );
    }

    if (!buildConfig.publish.owner || !buildConfig.publish.repo) {
      errors.push(
        "GitHub owner and repo must be configured in publish settings",
      );
      return false;
    }

    return true;
  } catch (error) {
    errors.push(`Failed to validate electron-updater config: ${error.message}`);
    return false;
  }
}

/**
 * Main validation function
 */
function validateRelease() {
  console.log("🔍 Validating release...\n");

  // Get version
  const version = getVersion();
  if (!version) {
    console.error("❌ Cannot validate release without version");
    process.exit(1);
  }

  console.log(`Version: ${version}\n`);

  // Validate version format
  validateVersion(version);

  // Check dist directory
  if (!checkDistDirectory()) {
    console.error("❌ Validation failed: dist directory missing");
    process.exit(1);
  }

  // Validate artifacts
  console.log("📦 Validating artifacts...");
  const artifacts = validateArtifacts(version);
  console.log(`Found artifacts: ${artifacts.found.length}`);
  if (artifacts.missing.length > 0) {
    console.log(`Missing artifacts: ${artifacts.missing.length}`);
  }

  // Validate checksums
  console.log("\n🔐 Validating checksums...");
  validateChecksums(version);

  // Check git tag
  console.log("\n🏷️  Checking git tag...");
  checkGitTag(version);

  // Validate release notes
  console.log("\n📝 Validating release notes...");
  validateReleaseNotes();

  // Check electron-updater config
  console.log("\n⚙️  Validating electron-updater configuration...");
  checkElectronUpdaterConfig();

  // Print results
  console.log("\n" + "=".repeat(50));
  if (errors.length === 0 && warnings.length === 0) {
    console.log("✅ Release validation passed!");
    process.exit(0);
  } else {
    if (warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${warnings.length}):`);
      warnings.forEach((warning) => console.log(`   - ${warning}`));
    }

    if (errors.length > 0) {
      console.log(`\n❌ Errors (${errors.length}):`);
      errors.forEach((error) => console.log(`   - ${error}`));
      console.log("\n❌ Release validation failed!");
      process.exit(1);
    } else {
      console.log("\n✅ Release validation passed with warnings");
      process.exit(0);
    }
  }
}

if (require.main === module) {
  validateRelease();
}

module.exports = { validateRelease, validateVersion, validateArtifacts };
