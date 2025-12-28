#!/usr/bin/env node
/**
 * Check for outdated npm packages
 * Supports STRICT mode (any outdated) or BALANCED mode (2+ major versions behind)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const STRICTNESS = process.env.STRICTNESS || 'BALANCED';
const PROJECT_PATH = process.argv[2] || '.';
const PROJECT_NAME = process.argv[3] || 'project';

console.log(`Checking ${PROJECT_NAME} packages...`);

// Run npm outdated and capture output
const tempFile = path.join(os.tmpdir(), `outdated-${PROJECT_NAME}.json`);
try {
  const { execSync } = require('child_process');
  const result = execSync(`npm outdated --json`, {
    cwd: PROJECT_PATH,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  fs.writeFileSync(tempFile, result);
} catch (error) {
  // npm outdated returns non-zero exit code when outdated packages exist
  // The output is still captured in error.stdout
  if (error.stdout) {
    fs.writeFileSync(tempFile, error.stdout);
  } else {
    fs.writeFileSync(tempFile, '{}');
  }
}

// Parse the output
let data = {};
try {
  const content = fs.readFileSync(tempFile, 'utf-8');
  // Filter out npm warnings/errors, keep only JSON lines
  const lines = content.split('\n');
  const jsonLines = lines.filter((l) => !l.startsWith('npm ') && !l.startsWith('npm WARN'));
  const jsonStr = jsonLines.join('\n').trim();

  if (jsonStr && jsonStr.startsWith('{')) {
    data = JSON.parse(jsonStr);
  }
} catch (error) {
  // If no outdated packages, npm outdated returns empty
  console.log(`✅ All ${PROJECT_NAME} packages are on latest version (no outdated packages)`);
  process.exit(0);
}

const outdated = Object.entries(data);

if (outdated.length === 0) {
  console.log(`✅ All ${PROJECT_NAME} packages are on latest version`);
  process.exit(0);
}

if (STRICTNESS === 'STRICT') {
  console.log('🔒 STRICT MODE: Checking for ANY outdated packages...');
  console.log(`❌ Outdated packages found (strict mode):`);

  outdated.forEach(([name, info]) => {
    const current = info.current || info.installed || 'not-installed';
    const latest = info.latest || 'unknown';
    console.log(`  - ${name}: ${current} → ${latest}`);
  });

  process.exit(1);
} else {
  console.log('⚖️ BALANCED MODE: Checking for severely outdated (2+ major versions)...');

  const severe = outdated.filter(([_, info]) => {
    const current = info.current || info.installed;
    const latest = info.latest;
    
    if (!current || !latest) return false;
    
    const currentMajor = parseInt(current.split('.')[0] || '0');
    const latestMajor = parseInt(latest.split('.')[0] || '0');
    return latestMajor - currentMajor >= 2;
  });

  if (severe.length > 0) {
    console.log('❌ Severely outdated packages (2+ major versions behind):');
    severe.forEach(([name, info]) => {
      const current = info.current || info.installed || 'not-installed';
      console.log(`  - ${name}: ${current} → ${info.latest}`);
    });
    process.exit(1);
  }

  console.log(`✅ No severely outdated ${PROJECT_NAME} packages`);
  if (outdated.length > 0) {
    console.log(`ℹ️  ${outdated.length} package(s) are 1 major version behind (allowed in BALANCED mode)`);
  }
  process.exit(0);
}
