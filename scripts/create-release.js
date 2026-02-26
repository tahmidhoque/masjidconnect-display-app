#!/usr/bin/env node
/**
 * Create Release Script
 *
 * Comprehensive script for creating releases with validation and git tagging.
 * Ensures semantic versioning, runs tests, and creates proper git tags.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PACKAGE_JSON_PATH = path.join(__dirname, "../package.json");
const SEMVER_REGEX =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

/**
 * Validate semantic version format
 */
function validateVersion(version) {
  if (!SEMVER_REGEX.test(version)) {
    throw new Error(
      `Invalid version format: ${version}. Must follow semantic versioning (e.g., 1.0.0, 1.0.0-beta.1)`,
    );
  }
  return true;
}

/**
 * Check if git working directory is clean
 */
function checkGitClean() {
  try {
    const status = execSync("git status --porcelain", {
      encoding: "utf-8",
    }).trim();
    if (status) {
      throw new Error(
        "Git working directory is not clean. Please commit or stash changes before creating a release.",
      );
    }
  } catch (error) {
    if (error.message.includes("not clean")) {
      throw error;
    }
    throw new Error("Failed to check git status: " + error.message);
  }
}

/**
 * Check if tests pass
 */
function runTests() {
  console.log("Running tests...");
  try {
    execSync("npm test", {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
    });
    console.log("✅ All tests passed");
  } catch (error) {
    throw new Error(
      "Tests failed. Please fix tests before creating a release.",
    );
  }
}

/**
 * Get current version from package.json
 */
function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8"));
  return packageJson.version;
}

/**
 * Update version in package.json
 */
function updateVersion(newVersion) {
  validateVersion(newVersion);
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8"));
  const oldVersion = packageJson.version;
  packageJson.version = newVersion;
  fs.writeFileSync(
    PACKAGE_JSON_PATH,
    JSON.stringify(packageJson, null, 2) + "\n",
  );
  console.log(`✅ Updated version from ${oldVersion} to ${newVersion}`);
  return oldVersion;
}

/**
 * Check if git tag already exists
 */
function tagExists(tag) {
  try {
    execSync(`git rev-parse ${tag}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate CHANGELOG entry from git commits
 */
function generateChangelog(version, previousTag) {
  try {
    let commits;
    if (previousTag) {
      commits = execSync(
        `git log ${previousTag}..HEAD --pretty=format:"- %s (%h)"`,
        { encoding: "utf-8" },
      ).trim();
    } else {
      commits = execSync('git log --pretty=format:"- %s (%h)"', {
        encoding: "utf-8",
      }).trim();
    }

    if (!commits) {
      commits = "- No changes";
    }

    const changelogEntry = `## [${version}] - ${new Date().toISOString().split("T")[0]}\n\n${commits}\n\n`;
    return changelogEntry;
  } catch (error) {
    console.warn("Warning: Could not generate changelog:", error.message);
    return `## [${version}] - ${new Date().toISOString().split("T")[0]}\n\n- Release ${version}\n\n`;
  }
}

/**
 * Update CHANGELOG.md
 */
function updateChangelog(version) {
  const changelogPath = path.join(__dirname, "../CHANGELOG.md");
  let changelog = "";

  // Try to get previous tag
  let previousTag = null;
  try {
    previousTag = execSync("git describe --tags --abbrev=0 HEAD^ 2>/dev/null", {
      encoding: "utf-8",
    }).trim();
  } catch {
    // No previous tag, that's okay
  }

  const entry = generateChangelog(version, previousTag);

  if (fs.existsSync(changelogPath)) {
    changelog = fs.readFileSync(changelogPath, "utf-8");
  } else {
    changelog =
      "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n";
  }

  // Insert new entry after "# Changelog" header
  const lines = changelog.split("\n");
  const headerIndex = lines.findIndex((line) => line.startsWith("# Changelog"));
  if (headerIndex >= 0) {
    lines.splice(headerIndex + 2, 0, entry);
  } else {
    lines.push(entry);
  }

  fs.writeFileSync(changelogPath, lines.join("\n"));
  console.log("✅ Updated CHANGELOG.md");
}

/**
 * Create git tag
 */
function createGitTag(version) {
  const tag = `v${version}`;

  if (tagExists(tag)) {
    throw new Error(
      `Tag ${tag} already exists. Please use a different version.`,
    );
  }

  execSync(`git tag -a ${tag} -m "Release ${version}"`, { stdio: "inherit" });
  console.log(`✅ Created git tag: ${tag}`);
  return tag;
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const versionArg = args.find((arg) => !arg.startsWith("--"));
  const skipTests = args.includes("--skip-tests");
  const skipChangelog = args.includes("--skip-changelog");
  const dryRun = args.includes("--dry-run");

  try {
    console.log("🚀 Creating release...\n");

    // Get version
    let newVersion;
    if (versionArg) {
      newVersion = versionArg.replace(/^v/, ""); // Remove 'v' prefix if present
      validateVersion(newVersion);
    } else {
      // Prompt for version (in real implementation, could use readline)
      throw new Error(
        "Version argument required. Usage: node create-release.js <version> [--skip-tests] [--skip-changelog] [--dry-run]",
      );
    }

    const currentVersion = getCurrentVersion();
    console.log(`Current version: ${currentVersion}`);
    console.log(`New version: ${newVersion}\n`);

    if (newVersion === currentVersion) {
      throw new Error(`Version ${newVersion} is already the current version.`);
    }

    // Pre-release checks
    if (!dryRun) {
      checkGitClean();

      if (!skipTests) {
        runTests();
      }
    }

    // Update version
    if (!dryRun) {
      updateVersion(newVersion);

      // Update CHANGELOG
      if (!skipChangelog) {
        updateChangelog(newVersion);
      }

      // Create git commit
      console.log("\n📝 Creating git commit...");
      execSync("git add package.json", { stdio: "inherit" });
      if (
        !skipChangelog &&
        fs.existsSync(path.join(__dirname, "../CHANGELOG.md"))
      ) {
        execSync("git add CHANGELOG.md", { stdio: "inherit" });
      }
      execSync(`git commit -m "Bump version to ${newVersion}"`, {
        stdio: "inherit",
      });
      console.log("✅ Created git commit");

      // Create git tag
      console.log("\n🏷️  Creating git tag...");
      const tag = createGitTag(newVersion);

      console.log("\n✅ Release preparation complete!");
      console.log("\nNext steps:");
      console.log(`1. Review changes: git show HEAD`);
      console.log(`2. Push changes: git push`);
      console.log(`3. Push tag: git push origin ${tag}`);
      console.log(
        `4. GitHub Actions will automatically build and create release`,
      );
    } else {
      console.log("\n✅ Dry run complete. No changes made.");
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateVersion, updateVersion, createGitTag };
