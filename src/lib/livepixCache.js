const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'livepix_posted_messages.json');

function ensureCacheFile() {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    if (!fs.existsSync(CACHE_FILE)) fs.writeFileSync(CACHE_FILE, '[]', 'utf8');
  } catch (_) {}
}

function loadPostedMessagesSet() {
  ensureCacheFile();
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr);
  } catch (_) {}
  return new Set();
}

function savePostedMessagesSet(set) {
  ensureCacheFile();
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(Array.from(set)), 'utf8');
  } catch (_) {}
}

module.exports = { loadPostedMessagesSet, savePostedMessagesSet };
