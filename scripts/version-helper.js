#!/usr/bin/env node

/**
 * Version Helper Script for Dual Angular Support
 * 
 * This script determines the appropriate version strategy based on the current branch:
 * - main branch: Uses Angular 15.x.y versioning  
 * 
 * Works in coordination with Nx release to maintain proper major version constraints.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error('Failed to get current branch:', error.message);
    process.exit(1);
  }
}

function getCurrentVersionFromPackage() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function updatePackageVersion() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  const currentBranch = getCurrentBranch();
  const currentVersion = packageJson.version;
  
  console.log(`Current branch: ${currentBranch}`);
  console.log(`Current version: ${currentVersion}`);
  
  // Parse current version to understand its structure
  const versionParts = currentVersion.split('.');
  const currentMajor = parseInt(versionParts[0]) || 0;
  const currentMinor = parseInt(versionParts[1]) || 0;
  const currentPatch = parseInt(versionParts[2]) || 0;
  
  let targetMajor, newVersion;
  let packageNameSuffix = '';
  
  if (currentBranch === 'main') {
    // Main branch should be on Angular 15 (major version 15)
    targetMajor = 15;
    
    if (currentMajor !== targetMajor) {
      // If we're not on the right major version, set it to the target
      newVersion = `${targetMajor}.2.${currentPatch}`;
      console.log(`Main branch detected - adjusting to Angular 15 versioning: ${newVersion}`);
    } else {
      // Already on correct major version, keep current version
      newVersion = currentVersion;
      console.log(`Main branch detected - keeping current Angular 15 version: ${newVersion}`);
    }
  } else {
    console.log(`Unknown branch: ${currentBranch} - keeping current version`);
    return;
  }
  
  // Only update if the version actually changed
  if (newVersion !== currentVersion) {
    packageJson.version = newVersion;
    
    if (packageNameSuffix) {
      if (!packageJson.name.includes(packageNameSuffix)) {
        packageJson.name = packageJson.name + packageNameSuffix;
      }
    }
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`Updated package.json: ${packageJson.name}@${newVersion}`);
    
    // Also update the library package.json
    const libPackageJsonPath = path.join(__dirname, '..', 'projects', 'picker', 'package.json');
    if (fs.existsSync(libPackageJsonPath)) {
      const libPackageJson = JSON.parse(fs.readFileSync(libPackageJsonPath, 'utf8'));
      libPackageJson.version = newVersion;
      if (packageNameSuffix && !libPackageJson.name.includes(packageNameSuffix)) {
        libPackageJson.name = libPackageJson.name + packageNameSuffix;
      }
      fs.writeFileSync(libPackageJsonPath, JSON.stringify(libPackageJson, null, 2) + '\n');
      console.log(`Updated library package.json: ${libPackageJson.name}@${newVersion}`);
    }
  } else {
    console.log(`Version already correct for branch ${currentBranch}: ${newVersion}`);
    
    // Still need to check package name suffix
    if (packageNameSuffix) {
      if (!packageJson.name.includes(packageNameSuffix)) {
        packageJson.name = packageJson.name + packageNameSuffix;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        console.log(`Updated package name: ${packageJson.name}`);
      }
    }
  }
}

function validateVersionForBranch() {
  const currentBranch = getCurrentBranch();
  const currentVersion = getCurrentVersionFromPackage();
  const versionParts = currentVersion.split('.');
  const currentMajor = parseInt(versionParts[0]) || 0;
  
  console.log(`Validating version ${currentVersion} for branch ${currentBranch}`);
  
  if (currentBranch === 'main' && currentMajor !== 15) {
    console.error(`ERROR: Main branch should have major version 15, but found ${currentMajor}`);
    process.exit(1);
  }
  
  console.log(`✅ Version ${currentVersion} is valid for branch ${currentBranch}`);
}

function getVersionInfo() {
  const currentBranch = getCurrentBranch();
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  return {
    branch: currentBranch,
    version: packageJson.version,
    packageName: packageJson.name,
    isMainBranch: currentBranch === 'main',
    expectedMajorVersion: currentBranch === 'main' ? 15 : null
  };
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'update':
      updatePackageVersion();
      break;
    case 'info':
      console.log(JSON.stringify(getVersionInfo(), null, 2));
      break;
    case 'validate':
      validateVersionForBranch();
      break;
    default:
      console.log('Usage: node version-helper.js [update|info|validate]');
      console.log('  update: Update package.json version based on current branch');
      console.log('  info: Get current version info');
      console.log('  validate: Validate that current version matches branch expectations');
      process.exit(1);
  }
}

module.exports = { getCurrentBranch, updatePackageVersion, getVersionInfo, validateVersionForBranch };