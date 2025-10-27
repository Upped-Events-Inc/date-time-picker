#!/usr/bin/env node

/**
 * Simple Changelog Generator for Safe Versioning System
 * 
 * This script generates a basic changelog based on git commits since the last tag
 * and commits the changes with proper git tags for our safe versioning system.
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

function getCurrentVersion() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function getCurrentBranch() {
  return runCommand('git rev-parse --abbrev-ref HEAD');
}

function getCommitsSinceLastTag() {
  try {
    // Get the last tag
    const lastTag = runCommand('git describe --tags --abbrev=0 2>/dev/null || echo ""');
    
    let gitLogCommand;
    if (lastTag) {
      gitLogCommand = `git log ${lastTag}..HEAD --oneline --no-merges`;
      console.log(`Getting commits since last tag: ${lastTag}`);
    } else {
      // If no tags, get recent commits
      gitLogCommand = 'git log --oneline --no-merges -10';
      console.log('No previous tags found, getting recent commits');
    }
    
    const commits = runCommand(gitLogCommand);
    return {
      commits: commits ? commits.split('\n').filter(line => line.trim()) : [],
      lastTag: lastTag || null
    };
  } catch (error) {
    console.log('No commits found or no git history');
    return { commits: [], lastTag: null };
  }
}

function categorizeCommits(commits) {
  const categories = {
    breaking: [],
    features: [],
    fixes: [],
    other: []
  };
  
  for (const commit of commits) {
    const message = commit.toLowerCase();
    const fullCommit = commit;
    
    if (message.includes('breaking change') || message.includes('!:')) {
      categories.breaking.push(fullCommit);
    } else if (message.includes('feat:') || message.includes('feat(')) {
      categories.features.push(fullCommit);
    } else if (message.includes('fix:') || message.includes('fix(')) {
      categories.fixes.push(fullCommit);
    } else {
      categories.other.push(fullCommit);
    }
  }
  
  return categories;
}

function generateChangelogEntry(version, categories, branch) {
  const date = new Date().toISOString().split('T')[0];
  const angularVersion = '15.x';
  
  let entry = `## [${version}] - ${date}\n\n`;
  entry += `### Angular ${angularVersion} Compatibility\n\n`;
  
  if (categories.breaking.length > 0) {
    entry += `### 🚨 Breaking Changes\n`;
    categories.breaking.forEach(commit => {
      const [hash, ...messageParts] = commit.split(' ');
      entry += `- ${messageParts.join(' ')} (${hash})\n`;
    });
    entry += '\n';
  }
  
  if (categories.features.length > 0) {
    entry += `### ✨ Features\n`;
    categories.features.forEach(commit => {
      const [hash, ...messageParts] = commit.split(' ');
      entry += `- ${messageParts.join(' ')} (${hash})\n`;
    });
    entry += '\n';
  }
  
  if (categories.fixes.length > 0) {
    entry += `### 🐛 Bug Fixes\n`;
    categories.fixes.forEach(commit => {
      const [hash, ...messageParts] = commit.split(' ');
      entry += `- ${messageParts.join(' ')} (${hash})\n`;
    });
    entry += '\n';
  }
  
  if (categories.other.length > 0) {
    entry += `### 🔧 Other Changes\n`;
    categories.other.forEach(commit => {
      const [hash, ...messageParts] = commit.split(' ');
      entry += `- ${messageParts.join(' ')} (${hash})\n`;
    });
    entry += '\n';
  }
  
  return entry;
}

function updateChangelog(newEntry) {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  
  let existingContent = '';
  if (fs.existsSync(changelogPath)) {
    existingContent = fs.readFileSync(changelogPath, 'utf8');
  } else {
    existingContent = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  }
  
  // Insert new entry after the header
  const lines = existingContent.split('\n');
  const headerEndIndex = lines.findIndex(line => line.startsWith('## [')) || lines.length;
  
  if (headerEndIndex === -1 || headerEndIndex === lines.length) {
    // No existing entries, add after header
    const headerLines = lines.slice(0, 3); // "# Changelog" + description + empty line
    const newContent = [...headerLines, '', newEntry.trim(), '', ...lines.slice(3)].join('\n');
    fs.writeFileSync(changelogPath, newContent);
  } else {
    // Insert before first existing entry
    const newContent = [...lines.slice(0, headerEndIndex), newEntry.trim(), '', ...lines.slice(headerEndIndex)].join('\n');
    fs.writeFileSync(changelogPath, newContent);
  }
  
  console.log(`Updated CHANGELOG.md`);
}

function createGitTag(version, branch) {
  const tagName = `${branch}-v${version}`;
  const tagMessage = `Release ${version} for ${branch} branch`;
  
  try {
    // Check if tag already exists
    const existingTag = runCommand(`git tag -l "${tagName}"`);
    if (existingTag) {
      console.log(`Tag ${tagName} already exists, skipping tag creation`);
      return tagName;
    }
    
    runCommand(`git tag -a "${tagName}" -m "${tagMessage}"`);
    console.log(`Created git tag: ${tagName}`);
    return tagName;
  } catch (error) {
    console.error(`Failed to create git tag: ${error.message}`);
    return null;
  }
}

function generateChangelog() {
  const version = getCurrentVersion();
  const branch = getCurrentBranch();
  
  console.log(`📝 Generating changelog for version ${version} on branch ${branch}`);
  
  const { commits, lastTag } = getCommitsSinceLastTag();
  
  if (commits.length === 0) {
    console.log('No new commits found since last tag, skipping changelog generation');
    return;
  }
  
  console.log(`Found ${commits.length} commits since ${lastTag || 'beginning'}:`);
  commits.forEach(commit => console.log(`  - ${commit}`));
  
  const categories = categorizeCommits(commits);
  const changelogEntry = generateChangelogEntry(version, categories, branch);
  
  console.log('\nGenerated changelog entry:');
  console.log('─'.repeat(50));
  console.log(changelogEntry);
  console.log('─'.repeat(50));
  
  updateChangelog(changelogEntry);
  
  // Stage the changelog
  runCommand('git add CHANGELOG.md');
  
  // Commit the changelog
  const commitMessage = `chore(release): add changelog for ${version} [skip ci]`;
  runCommand(`git commit -m "${commitMessage}"`);
  console.log(`Committed changelog with message: ${commitMessage}`);
  
  // Create git tag
  const tagName = createGitTag(version, branch);
  
  console.log(`✅ Changelog generated and committed for version ${version}`);
  if (tagName) {
    console.log(`✅ Git tag created: ${tagName}`);
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'generate':
      generateChangelog();
      break;
    default:
      console.log('Usage: node changelog-generator.js generate');
      console.log('  generate: Generate changelog and create git tag');
      process.exit(1);
  }
}

module.exports = { generateChangelog };