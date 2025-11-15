#!/usr/bin/env node
/**
 * Rollback Release Script
 *
 * Marks a release as deprecated and optionally creates a new patch release.
 * Can be used to deprecate problematic releases and prevent devices from updating to them.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SEMVER_REGEX =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

/**
 * Validate version format
 */
function validateVersion(version) {
  if (!SEMVER_REGEX.test(version)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return true;
}

/**
 * Get current version from package.json
 */
function getCurrentVersion() {
  const packageJsonPath = path.join(__dirname, "../package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  return packageJson.version;
}

/**
 * Increment patch version
 */
function incrementPatchVersion(version) {
  const match = version.match(SEMVER_REGEX);
  if (!match) {
    throw new Error(`Invalid version: ${version}`);
  }

  const [, major, minor, patch, prerelease] = match;
  const newPatch = parseInt(patch, 10) + 1;
  return prerelease
    ? `${major}.${minor}.${newPatch}-${prerelease}`
    : `${major}.${minor}.${newPatch}`;
}

/**
 * Mark release as deprecated on GitHub
 */
function deprecateRelease(version, reason) {
  const tag = `v${version}`;
  console.log(`\n📝 Deprecating release ${tag}...`);

  // Note: This would require GitHub API calls to update the release
  // For now, we'll provide instructions
  console.log("\nTo deprecate the release on GitHub:");
  console.log(
    `1. Go to: https://github.com/masjidSolutions/masjidconnect-display-app/releases/tag/${tag}`,
  );
  console.log('2. Click "Edit release"');
  console.log('3. Check "Set as a pre-release" to hide it from auto-updater');
  console.log(
    `4. Add deprecation notice: ${reason || "This release has been deprecated due to issues"}`,
  );
  console.log("5. Save changes");

  return true;
}

/**
 * Create new patch release
 */
function createPatchRelease(rollbackVersion, reason) {
  validateVersion(rollbackVersion);

  const currentVersion = getCurrentVersion();
  const newVersion = incrementPatchVersion(rollbackVersion);

  console.log(
    `\n🔄 Creating patch release ${newVersion} to replace ${rollbackVersion}...`,
  );
  console.log(`Reason: ${reason || "Rollback from problematic release"}`);

  // Update version in package.json
  const packageJsonPath = path.join(__dirname, "../package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  packageJson.version = newVersion;
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + "\n",
  );

  console.log(`✅ Updated version to ${newVersion}`);
  console.log("\nNext steps:");
  console.log(`1. Review changes: git diff package.json`);
  console.log(
    `2. Commit: git add package.json && git commit -m "Rollback: Create patch release ${newVersion} to replace ${rollbackVersion}"`,
  );
  console.log(
    `3. Tag: git tag -a v${newVersion} -m "Rollback release ${newVersion} - replaces ${rollbackVersion}"`,
  );
  console.log(`4. Push: git push && git push origin v${newVersion}`);
  console.log("5. GitHub Actions will automatically build and release");

  return newVersion;
}

/**
 * Update CHANGELOG with rollback notice
 */
function updateChangelog(rollbackVersion, newVersion, reason) {
  const changelogPath = path.join(__dirname, "../CHANGELOG.md");
  let changelog = "";

  if (fs.existsSync(changelogPath)) {
    changelog = fs.readFileSync(changelogPath, "utf-8");
  } else {
    changelog =
      "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n";
  }

  const rollbackEntry = `## [${newVersion}] - ${new Date().toISOString().split("T")[0]}

### Rollback Release

This release replaces version ${rollbackVersion} which has been deprecated.

**Reason:** ${reason || "Issues identified in the previous release"}

**Action Required:** Devices running ${rollbackVersion} should update to ${newVersion} immediately.

---

## [DEPRECATED] ${rollbackVersion}

⚠️ **This release has been deprecated and should not be installed.**

${reason || "This release contains issues and has been replaced by a newer version."}

---

`;

  const lines = changelog.split("\n");
  const headerIndex = lines.findIndex((line) => line.startsWith("# Changelog"));
  if (headerIndex >= 0) {
    lines.splice(headerIndex + 2, 0, rollbackEntry);
  } else {
    lines.push(rollbackEntry);
  }

  fs.writeFileSync(changelogPath, lines.join("\n"));
  console.log("✅ Updated CHANGELOG.md with rollback notice");
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const versionArg = args.find((arg) => !arg.startsWith("--"));
  const createPatch = args.includes("--create-patch");
  const reasonArg = args.find((arg) => arg.startsWith("--reason="));
  const reason = reasonArg ? reasonArg.split("=")[1] : null;

  try {
    if (!versionArg) {
      throw new Error(
        'Version argument required. Usage: node rollback-release.js <version> [--create-patch] [--reason="reason"]',
      );
    }

    const rollbackVersion = versionArg.replace(/^v/, "");
    validateVersion(rollbackVersion);

    console.log("🔄 Rollback Release Process\n");
    console.log(`Version to rollback: ${rollbackVersion}`);
    if (reason) {
      console.log(`Reason: ${reason}`);
    }
    console.log("");

    // Deprecate the release
    deprecateRelease(rollbackVersion, reason);

    // Optionally create patch release
    if (createPatch) {
      const newVersion = createPatchRelease(rollbackVersion, reason);
      updateChangelog(rollbackVersion, newVersion, reason);

      console.log("\n✅ Rollback process initiated");
      console.log(`   Deprecated: ${rollbackVersion}`);
      console.log(`   New release: ${newVersion}`);
    } else {
      console.log("\n✅ Release marked for deprecation");
      console.log("   Follow the instructions above to deprecate on GitHub");
      console.log(
        "   Use --create-patch flag to automatically create a replacement release",
      );
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { deprecateRelease, createPatchRelease };
