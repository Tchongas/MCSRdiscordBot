const fs = require('fs');
const path = require('path');

// Simple JSON file store with directory auto-creation and best-effort atomic writes
// Files will be stored under src/data/
const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function resolve(file) {
  ensureDir();
  return path.join(DATA_DIR, file);
}

function readJson(file, defaultValue) {
  const p = resolve(file);
  if (!fs.existsSync(p)) return defaultValue;
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return defaultValue;
  }
}

function writeJson(file, value) {
  const p = resolve(file);
  const tmp = p + '.tmp';
  const str = JSON.stringify(value, null, 2);
  fs.writeFileSync(tmp, str, 'utf8');
  fs.renameSync(tmp, p);
}

module.exports = { readJson, writeJson, resolve, DATA_DIR };
