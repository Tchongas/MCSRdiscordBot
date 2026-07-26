const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.resolve(process.cwd(), '.cache');
const CACHE_FILE = path.join(CACHE_DIR, 'paceman_pings.json');

// Tier thresholds in milliseconds for the splits we care about.
// Index 0 = RB Pace, 1 = Tier 2, 2 = Tier 3.
const TIER_THRESHOLDS_MS = {
  'rsg.first_portal': [(5 * 60 + 40) * 1000, 7 * 60 * 1000, 8 * 60 * 1000],
  'rsg.enter_stronghold': [(6 * 60 + 50) * 1000, 9 * 60 * 1000, 12 * 60 * 1000],
  'rsg.enter_end': [(7 * 60 + 10) * 1000, 10 * 60 * 1000, 13 * 60 * 1000],
};

const CREDITS_TIER_THRESHOLDS_MS = [(9 * 60) * 1000, (11 * 60) * 1000, (15 * 60) * 1000];

const TIER_NAMES = ['RB Pace', 'Tier 2', 'Tier 3'];

const TIER_ROLE_IDS = [
  process.env.PACEMAN_TIER_1_ROLE_ID,
  process.env.PACEMAN_TIER_2_ROLE_ID,
  process.env.PACEMAN_TIER_3_ROLE_ID,
];

function ensureCacheFile() {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    if (!fs.existsSync(CACHE_FILE)) fs.writeFileSync(CACHE_FILE, '{}', 'utf8');
  } catch (_) { /* ignore */ }
}

function loadPingCache() {
  ensureCacheFile();
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
  } catch (_) {}
  return {};
}

function savePingCache(cache) {
  ensureCacheFile();
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
  } catch (_) { /* ignore */ }
}

let pingCache = loadPingCache();

function getRunPingState(worldId) {
  if (!pingCache[worldId]) {
    pingCache[worldId] = { pingedTierIndexes: [], pingedCreditsTierIndexes: [], lastUpdated: 0 }; 
  }
  return pingCache[worldId];
}

function hasPingedTier(worldId, tierIndex) {
  return getRunPingState(worldId).pingedTierIndexes.includes(tierIndex);
}

function markTierIndexesPinged(worldId, tierIndexes) {
  if (!tierIndexes || tierIndexes.length === 0) return;
  const entry = getRunPingState(worldId);
  for (const idx of tierIndexes) {
    if (!entry.pingedTierIndexes.includes(idx)) {
      entry.pingedTierIndexes.push(idx);
    }
  }
  entry.lastUpdated = Date.now();
  savePingCache(pingCache);
}

function hasPingedCreditsTier(worldId, tierIndex) {
  const entry = getRunPingState(worldId);
  return (entry.pingedCreditsTierIndexes || []).includes(tierIndex);
}

function markCreditsTierIndexesPinged(worldId, tierIndexes) {
  if (!tierIndexes || tierIndexes.length === 0) return;
  const entry = getRunPingState(worldId);
  if (!Array.isArray(entry.pingedCreditsTierIndexes)) entry.pingedCreditsTierIndexes = [];
  for (const idx of tierIndexes) {
    if (!entry.pingedCreditsTierIndexes.includes(idx)) {
      entry.pingedCreditsTierIndexes.push(idx);
    }
  }
  entry.lastUpdated = Date.now();
  savePingCache(pingCache);
}

function getQualifyingTierIndexes(event) {
  const thresholds = TIER_THRESHOLDS_MS[event.eventId];
  if (!thresholds || !Number.isFinite(event.igt)) return [];
  const indexes = [];
  for (let i = 0; i < thresholds.length; i++) {
    if (event.igt < thresholds[i]) indexes.push(i);
  }
  return indexes;
}

function getQualifyingCreditsTierIndexes(event) {
  if (event?.eventId !== 'rsg.credits' || !Number.isFinite(event.igt)) return [];
  const indexes = [];
  for (let i = 0; i < CREDITS_TIER_THRESHOLDS_MS.length; i++) {
    if (event.igt < CREDITS_TIER_THRESHOLDS_MS[i]) indexes.push(i);
  }
  return indexes;
}

/**
 * Returns the ping content and the list of tier indexes that should be marked as pinged.
 * Does NOT modify the ping cache, so the caller can decide when to commit.
 */
function getPendingPings(worldId, events) {
  if (!Array.isArray(events) || events.length === 0) return { content: null, tierIndexes: [] };
  if (TIER_ROLE_IDS.every(id => !id)) return { content: null, tierIndexes: [] };

  const newlyPinged = [];
  const mentions = [];

  for (const event of events) {
    const qualifying = getQualifyingTierIndexes(event);
    for (const idx of qualifying) {
      if (hasPingedTier(worldId, idx)) continue;
      const roleId = TIER_ROLE_IDS[idx];
      if (!roleId) continue;
      newlyPinged.push(idx);
      mentions.push(`<@&${roleId}>`);
    }
  }

  if (newlyPinged.length === 0) return { content: null, tierIndexes: [] };
  return { content: mentions.join(' '), tierIndexes: newlyPinged };
}

function getPendingCreditsPings(worldId, event) {
  const qualifying = getQualifyingCreditsTierIndexes(event);
  if (qualifying.length === 0) return { content: null, tierIndexes: [] };

  const tierIndexes = qualifying.filter(idx => !hasPingedCreditsTier(worldId, idx));
  const content = tierIndexes
    .map(idx => TIER_ROLE_IDS[idx])
    .filter(Boolean)
    .map(roleId => `<@&${roleId}>`)
    .join(' ');
  return { content: content || null, tierIndexes };
}

module.exports = {
  TIER_NAMES,
  TIER_ROLE_IDS,
  getPendingPings,
  getPendingCreditsPings,
  markTierIndexesPinged,
  markCreditsTierIndexesPinged,
};
