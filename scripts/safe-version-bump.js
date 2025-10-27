#!/usr/bin/env node

/**
 * Safe Version Bumper for Dual Angular Support
 * 
 * This script safely bumps versions while respecting branch major version constraints:
 * - main branch: Never exceeds 15.x.x (Angular 15)
 * 
 * It analyzes conventional commits and applies the appropriate version bump
 * while ensuring major version constraints are never violated.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runCommand(command, cwd = process.cwd()) {
  try {
    const result = execSync(command, { 
      cwd, 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return result.trim();
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(`Error: ${error.message}`);
    return '';
  }
}

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error('Failed to get current branch:', error.message);
    process.exit(1);
  }
}

function getVersionConstraints(branch) {
  switch (branch) {
    case 'main':
      return { maxMajor: 15, defaultMinor: 2 };
    default:
      return null;
  }
}

function getCommitsSinceLastTag() {
  try {
    // Get the last tag
    const lastTag = runCommand('git describe --tags --abbrev=0 2>/dev/null || echo ""');
    
    let gitLogCommand;
    if (lastTag) {
      gitLogCommand = `git log ${lastTag}..HEAD --oneline`;
    } else {
      // If no tags, get recent commits
      gitLogCommand = 'git log --oneline -10';
    }
    
    const commits = runCommand(gitLogCommand);
    return commits ? commits.split('\n').filter(line => line.trim()) : [];
  } catch (error) {
    console.log('No commits found or no git history');
    return [];
  }
}

function analyzeCommits(commits) {
  let hasBreaking = false;
  let hasFeature = false;
  let hasFix = false;
  
  for (const commit of commits) {
    const message = commit.toLowerCase();
    
    // Check for breaking changes
    if (message.includes('breaking change') || message.includes('!:')) {
      hasBreaking = true;
    }
    
    // Check for features
    if (message.startsWith('feat:') || message.startsWith('feat(')) {
      hasFeature = true;
    }
    
    // Check for fixes
    if (message.startsWith('fix:') || message.startsWith('fix(')) {
      hasFix = true;
    }
  }
  
  // Determine bump type (but never major)
  if (hasBreaking || hasFeature) {
    return 'minor';
  } else if (hasFix) {
    return 'patch';
  } else {
    return 'patch'; // Default to patch for other changes
  }
}

function calculateNewVersion(currentVersion, bumpType, constraints) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  // Ensure we're within the major version constraint
  if (major > constraints.maxMajor) {
    console.warn(`Current major version ${major} exceeds constraint ${constraints.maxMajor}`);
    return `${constraints.maxMajor}.${constraints.defaultMinor}.0`;
  }
  
  if (major < constraints.maxMajor) {
    // Bump to the target major version but keep minor/patch
    return `${constraints.maxMajor}.${constraints.defaultMinor}.${patch}`;
  }
  
  // We're at the correct major version, apply the bump
  switch (bumpType) {
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      return currentVersion;
  }
}

function updatePackageFiles(newVersion) {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`Updated root package.json to ${newVersion}`);
  
  // Update library package.json
  const libPackageJsonPath = path.join(__dirname, '..', 'projects', 'picker', 'package.json');
  if (fs.existsSync(libPackageJsonPath)) {
    const libPackageJson = JSON.parse(fs.readFileSync(libPackageJsonPath, 'utf8'));
    libPackageJson.version = newVersion;
    fs.writeFileSync(libPackageJsonPath, JSON.stringify(libPackageJson, null, 2) + '\n');
    console.log(`Updated library package.json to ${newVersion}`);
  }
}

function safeBumpVersion() {
  const currentBranch = getCurrentBranch();
  const constraints = getVersionConstraints(currentBranch);
  
  if (!constraints) {
    console.log(`Unknown branch ${currentBranch}, no version constraints defined`);
    return;
  }
  
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = packageJson.version;
  
  console.log(`🔍 Analyzing commits for version bump...`);
  console.log(`   Branch: ${currentBranch}`);
  console.log(`   Current version: ${currentVersion}`);
  console.log(`   Major version constraint: ≤${constraints.maxMajor}`);
  
  const commits = getCommitsSinceLastTag();
  
  if (commits.length === 0) {
    console.log(`   No new commits found, keeping version ${currentVersion}`);
    return;
  }
  
  console.log(`   Found ${commits.length} commits to analyze:`);
  commits.forEach(commit => console.log(`     - ${commit}`));
  
  const bumpType = analyzeCommits(commits);
  console.log(`   Recommended bump type: ${bumpType}`);
  
  const newVersion = calculateNewVersion(currentVersion, bumpType, constraints);
  
  if (newVersion === currentVersion) {
    console.log(`   No version change needed`);
    return;
  }
  
  console.log(`   New version: ${newVersion}`);
  
  // Validate the new version doesn't violate constraints
  const [newMajor] = newVersion.split('.').map(Number);
  if (newMajor > constraints.maxMajor) {
    console.error(`❌ ERROR: New version ${newVersion} would violate major version constraint ${constraints.maxMajor}`);
    process.exit(1);
  }
  
  updatePackageFiles(newVersion);
  console.log(`✅ Version safely bumped to ${newVersion}`);
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'bump':
      safeBumpVersion();
      break;
    default:
      console.log('Usage: node safe-version-bump.js bump');
      console.log('  bump: Safely bump version based on conventional commits');
      process.exit(1);
  }
}

module.exports = { safeBumpVersion };