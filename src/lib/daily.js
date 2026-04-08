const { readJson, writeJson } = require('./store');

const DAILY_FILE = 'daily.json';
const DAY_MS = 24 * 60 * 60 * 1000;
// Use fixed Brazil time (Brasília) UTC-3, since Brazil currently has no DST.
const BRASILIA_TZ_OFFSET_MS = -3 * 60 * 60 * 1000; // UTC-3

function load() {
  return readJson(DAILY_FILE, {});
}

function save(db) {
  writeJson(DAILY_FILE, db);
}

// Helpers to work with calendar-day reset using Brasília time (UTC-3)
function toDayKey(ms = Date.now()) {
  // Shift to Brasília time by adding the timezone offset, then read UTC Y-M-D
  const zoned = new Date(ms + BRASILIA_TZ_OFFSET_MS);
  const y = zoned.getUTCFullYear();
  const m = String(zoned.getUTCMonth() + 1).padStart(2, '0');
  const day = String(zoned.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameBrazilDay(aMs, bMs) {
  return toDayKey(aMs) === toDayKey(bMs);
}

function isPreviousBrazilDay(previousMs, currentMs) {
  if (!previousMs) return false;
  const currentZoned = new Date(currentMs + BRASILIA_TZ_OFFSET_MS);
  const previousDayStartUtc = Date.UTC(
    currentZoned.getUTCFullYear(),
    currentZoned.getUTCMonth(),
    currentZoned.getUTCDate() - 1,
    0,
    0,
    0
  );
  const previousDayEpoch = previousDayStartUtc - BRASILIA_TZ_OFFSET_MS;
  return toDayKey(previousMs) === toDayKey(previousDayEpoch);
}

function msUntilNextMidnight(now = Date.now()) {
  // Compute next midnight in Brasília time, then convert back to epoch ms
  const zoned = new Date(now + BRASILIA_TZ_OFFSET_MS);
  const y = zoned.getUTCFullYear();
  const m = zoned.getUTCMonth();
  const d = zoned.getUTCDate();
  // Next midnight in Brasília wall time
  const nextMidnightZonedUTC = Date.UTC(y, m, d + 1, 0, 0, 0);
  // Convert back to actual epoch ms by subtracting the offset we added before
  const nextMidnightEpoch = nextMidnightZonedUTC - BRASILIA_TZ_OFFSET_MS;
  return Math.max(0, nextMidnightEpoch - now);
}

function getLastClaim(userId) {
  const db = load();
  return Number(db[userId]?.lastClaimAt || 0);
}

function getRecord(userId) {
  const db = load();
  return db[userId] || { lastClaimAt: 0, streak: 0 };
}

function getStreak(userId) {
  const rec = getRecord(userId);
  return Number(rec.streak || 0);
}

function setClaimNow(userId) {
  const db = load();
  const current = db[userId] || { streak: 0 };
  db[userId] = { ...current, lastClaimAt: Date.now() };
  save(db);
}

function registerAnswer(userId, isCorrect, now = Date.now()) {
  const db = load();
  const current = db[userId] || { lastClaimAt: 0, streak: 0 };
  const previousClaimAt = Number(current.lastClaimAt || 0);

  let streak = Number(current.streak || 0);
  if (isCorrect) {
    streak = isPreviousBrazilDay(previousClaimAt, now) ? streak + 1 : 1;
  } else {
    streak = 0;
  }

  db[userId] = {
    ...current,
    lastClaimAt: now,
    streak,
  };
  save(db);
  return streak;
}

function timeLeftMs(userId, now = Date.now()) {
  const last = getLastClaim(userId);
  // If never claimed or last claim wasn't today, no wait time
  if (!last || !isSameBrazilDay(last, now)) return 0;
  // Claimed today: time left is until next local midnight
  return msUntilNextMidnight(now);
}

function canClaim(userId, now = Date.now()) {
  return timeLeftMs(userId, now) === 0;
}

module.exports = { getLastClaim, getStreak, setClaimNow, registerAnswer, timeLeftMs, canClaim, DAY_MS, msUntilNextMidnight };

