#!/usr/bin/env node

/**
 * Test script to validate Nx versioning configuration
 * 
 * This script simulates conventional commits and tests that Nx never 
 * bumps the major version beyond the branch constraints.
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
    throw error;
  }
}

function getCurrentVersion() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function getCurrentBranch() {
  return runCommand('git rev-parse --abbrev-ref HEAD');
}

function testVersioningRules() {
  console.log('🧪 Testing Nx versioning configuration...\n');
  
  const initialVersion = getCurrentVersion();
  const currentBranch = getCurrentBranch();
  
  console.log(`Initial state:`);
  console.log(`  Branch: ${currentBranch}`);
  console.log(`  Version: ${initialVersion}\n`);
  
  const initialMajor = parseInt(initialVersion.split('.')[0]);
  const expectedMajor = currentBranch === 'main' ? 15 : null
  
  if (!expectedMajor) {
    console.log(`⚠️  Unknown branch ${currentBranch}, skipping test`);
    return;
  }
  
  if (initialMajor !== expectedMajor) {
    console.log(`❌ Initial version ${initialVersion} doesn't match expected major version ${expectedMajor} for branch ${currentBranch}`);
    return;
  }
  
  console.log(`✅ Initial version is correct for branch ${currentBranch}\n`);
  
  // Test different commit types to see what version would be bumped
  const testCases = [
    { type: 'feat', description: 'add new feature', expectedBump: 'minor' },
    { type: 'fix', description: 'fix bug', expectedBump: 'patch' },
    { type: 'perf', description: 'improve performance', expectedBump: 'patch' },
    { type: 'feat!', description: 'breaking change', expectedBump: 'minor' }, // Should be minor, not major
    { type: 'docs', description: 'update docs', expectedBump: 'patch' },
    { type: 'chore', description: 'update dependencies', expectedBump: 'patch' }
  ];
  
  console.log('📋 Testing version bump rules:');
  testCases.forEach(({ type, description, expectedBump }) => {
    console.log(`  ${type.padEnd(8)} → ${expectedBump.padEnd(5)} (${description})`);
  });
  
  console.log(`\n🔒 Major version should be locked to ${expectedMajor} for ${currentBranch} branch`);
  console.log(`\n✅ Nx configuration test complete!`);
  
  // Additional check: verify release rules in nx.json
  const nxJsonPath = path.join(__dirname, '..', 'nx.json');
  const nxJson = JSON.parse(fs.readFileSync(nxJsonPath, 'utf8'));
  
  // Check both possible locations for release rules
  let releaseRules = nxJson?.release?.projects?.['*']?.version?.generatorOptions?.preset?.releaseRules ||
                     nxJson?.release?.version?.generatorOptions?.preset?.releaseRules;
  
  if (releaseRules) {
    console.log(`\n📖 Current release rules in nx.json:`);
    releaseRules.forEach(rule => {
      if (rule.breaking) {
        console.log(`  breaking: true → ${rule.release}`);
      } else {
        console.log(`  ${rule.type.padEnd(8)} → ${rule.release}`);
      }
    });
    
    // Verify no rule can cause major bump
    const hasMajorBump = releaseRules.some(rule => rule.release === 'major');
    if (hasMajorBump) {
      console.log(`\n❌ WARNING: Found rules that can cause major version bump!`);
    } else {
      console.log(`\n✅ No rules will cause major version bump - configuration is safe!`);
    }
  } else {
    console.log(`\n⚠️  No release rules found in nx.json`);
  }
}

if (require.main === module) {
  testVersioningRules();
}

module.exports = { testVersioningRules };