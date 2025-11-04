// Remove stray Android local.properties files inside node_modules to avoid
// SDK path overrides on CI/EAS (which can break Gradle variant creation).
// This commonly happens if Android Studio was opened in a library folder.

const fs = require('fs');
const path = require('path');

function deleteIfExists(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
      console.log(`[clean-local-properties] removed: ${filePath}`);
    }
  } catch (e) {
    console.warn(`[clean-local-properties] failed to remove ${filePath}:`, e.message);
  }
}

function walk(dir, onLocalProps) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return; // ignore unreadable dirs
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Only descend into likely paths to keep this quick
      if (entry.name === 'android' || dir.includes(`node_modules${path.sep}`)) {
        // Check for local.properties directly under android folders
        if (entry.name === 'android') {
          const lp = path.join(full, 'local.properties');
          onLocalProps(lp);
        }
        walk(full, onLocalProps);
      }
    }
  }
}

const nodeModules = path.join(process.cwd(), 'node_modules');
if (fs.existsSync(nodeModules)) {
  walk(nodeModules, deleteIfExists);
} else {
  console.log('[clean-local-properties] node_modules not found, skipping');
}

