const { readJson, writeJson } = require('./store');

const DAILY_FILE = 'daily.json';
const DAY_MS = 24 * 60 * 60 * 1000;

function load() {
  return readJson(DAILY_FILE, {});
}

function save(db) {
  writeJson(DAILY_FILE, db);
}

function getLastClaim(userId) {
  const db = load();
  return Number(db[userId]?.lastClaimAt || 0);
}

function setClaimNow(userId) {
  const db = load();
  db[userId] = { lastClaimAt: Date.now() };
  save(db);
}

function timeLeftMs(userId, now = Date.now()) {
  const last = getLastClaim(userId);
  const diff = now - last;
  return Math.max(0, DAY_MS - diff);
}

function canClaim(userId, now = Date.now()) {
  return timeLeftMs(userId, now) === 0;
}

module.exports = { getLastClaim, setClaimNow, timeLeftMs, canClaim, DAY_MS };
