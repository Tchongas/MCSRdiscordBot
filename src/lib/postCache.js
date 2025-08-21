const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'ranked_posted.json');

function ensureCacheFile() {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    if (!fs.existsSync(CACHE_FILE)) fs.writeFileSync(CACHE_FILE, '[]', 'utf8');
  } catch (_) { /* ignore */ }
}

function loadPostedSet() {
  ensureCacheFile();
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr);
  } catch (_) {}
  return new Set();
}

function savePostedSet(set) {
  ensureCacheFile();
  try {
    const arr = Array.from(set);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(arr), 'utf8');
  } catch (_) { /* ignore */ }
}

module.exports = { loadPostedSet, savePostedSet };
