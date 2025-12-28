#!/usr/bin/env node
/**
 * Check for outdated npm packages
 * Supports STRICT mode (any outdated) or BALANCED mode (2+ major versions behind)
 */

const fs = require('fs');
const { execSync } = require('child_process');

const STRICTNESS = process.env.STRICTNESS || 'BALANCED';
const PROJECT_PATH = process.argv[2] || '.';
const PROJECT_NAME = process.argv[3] || 'project';

console.log(`Checking ${PROJECT_NAME} packages...`);

// Run npm outdated and capture output
const tempFile = `/tmp/outdated-${PROJECT_NAME}.json`;
try {
  execSync(`cd ${PROJECT_PATH} && npm outdated --json > ${tempFile} 2>&1 || true`, {
    stdio: 'inherit',
  });
} catch (error) {
  // npm outdated returns non-zero if outdated packages exist
}

// Parse the output
let data = {};
try {
  const content = fs.readFileSync(tempFile, 'utf-8');
  // Filter out npm warnings/errors, keep only JSON lines
  const lines = content.split('\n');
  const jsonLines = lines.filter((l) => !l.startsWith('npm '));
  const jsonStr = jsonLines.join('\n').trim();

  if (jsonStr) {
    data = JSON.parse(jsonStr);
  }
} catch (error) {
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
    const current = info?.current || 'unknown';
    const latest = info?.latest || 'unknown';
    console.log(`  - ${name}: ${current} → ${latest}`);
  });

  process.exit(1);
} else {
  console.log('⚖️ BALANCED MODE: Checking for severely outdated (2+ major versions)...');

  const severe = outdated.filter(([_, info]) => {
    const currentMajor = parseInt(info?.current?.split('.')[0] || '0');
    const latestMajor = parseInt(info?.latest?.split('.')[0] || '0');
    return latestMajor - currentMajor >= 2;
  });

  if (severe.length > 0) {
    console.log('❌ Severely outdated packages (2+ major versions behind):');
    severe.forEach(([name, info]) => {
      console.log(`  - ${name}: ${info.current} → ${info.latest}`);
    });
    process.exit(1);
  }

  console.log(`✅ No severely outdated ${PROJECT_NAME} packages`);
  if (outdated.length > 0) {
    console.log(`ℹ️  ${outdated.length} package(s) are 1 major version behind (allowed in BALANCED mode)`);
  }
  process.exit(0);
}
