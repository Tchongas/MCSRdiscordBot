const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const logger = require('./logger');

const TROPHY_EMOJI = process.env.TROPHY_EMOJI || '🏆';
const GLOBE_EMOJI = process.env.GLOBE_EMOJI || '🌐';
const RANKED_EMOJI = process.env.RANKED_EMOJI || '🏆';
const COIN_EMOJI = process.env.COIN_EMOJI || '💰';
const CLOCK_EMOJI = process.env.CLOCK_EMOJI || '⏱';
const BURIED_TREASURE_EMOJI = process.env.BURIED_TREASURE_EMOJI || process.env.BURIED_TRASURE || '🏴‍☠️';
const SEED_EMOJI = process.env.SEED_EMOJI || '�';
const LOGO_EMOJI = process.env.LOGO_EMOJI || '�';
const MCSRBR_QUEUE_URL = 'mcsrbr.queuefish.ing';

const GOOGLE_RUNS_API_BASE = process.env.GOOGLE_RUNS_API_URL || 'https://script.google.com/macros/s/AKfycbztdxz4Cm5x03Xs_1mdX9Uxkf4g51FqohS-SqoAn28CPuvMAAJgdJsYhstp57PogdY4/exec';
const RANKED_API_BASE = 'https://api.mcsrranked.com/users';

const CACHE_DIR = path.resolve(__dirname, '../../data/cache');
const PROFILE_CACHE_FILE = path.join(CACHE_DIR, 'profile_cache.json');
const RANKED_CACHE_DIR = path.join(CACHE_DIR, 'ranked');
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const PROFILE_CACHE_TTL_MS = Number(process.env.PROFILE_CACHE_TTL_MS) || ONE_DAY_MS;
const RANKED_CACHE_TTL_MS = Number(process.env.RANKED_CACHE_TTL_MS) || ONE_DAY_MS;

const ACTIONS = {
  runners: 'getrunners',
  rsg: 'getrsg116',
  ssg: 'getssg116',
  earnings: 'getearnings',
};

let earningsCache = new Map();

let runnersCache = [];
let rsgRunsCache = [];
let ssgRunsCache = [];
let profileCacheLoaded = false;

const rankedStatsCache = new Map();

function buildApiUrl(action) {
  return `${GOOGLE_RUNS_API_BASE}?action=${action}`;
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

function parseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match.map(Number);
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(fullYear, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

function isValidUuid(value) {
  if (!value || typeof value !== 'string') return false;
  const clean = String(value).replace(/-/g, '');
  return /^[0-9a-fA-F]{32}$/.test(clean);
}

function unwrapArray(data, keys) {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const key of keys) {
      if (key in data && Array.isArray(data[key])) {
        return data[key];
      }
    }
  }
  return Array.isArray(data) ? data : [];
}

function parseRunners(data) {
  const rows = unwrapArray(data, ['runners', 'data', 'results', 'items']);
  return rows
    .filter(Array.isArray)
    .map(row => ({
      name: row[0],
      state: row[1],
      color: row[2],
      uuid: isValidUuid(row[3]) ? row[3] : null,
    }));
}

function parseRsgRuns(data) {
  const rows = unwrapArray(data, ['rsg', 'rsgRuns', 'runs', 'data', 'results', 'items']);
  return rows
    .filter(Array.isArray)
    .map(row => ({
      name: row[0],
      time: row[1],
      bastion: row[2],
      date: row[3],
      verified: row[4],
      seed: row[5],
      video: row[6],
      comment: row[7],
      parsedDate: parseDate(row[3]),
      type: 'RSG',
    }));
}

function parseSsgRuns(data) {
  const rows = unwrapArray(data, ['ssg', 'ssgRuns', 'runs', 'data', 'results', 'items']);
  return rows
    .filter(Array.isArray)
    .map(row => ({
      name: row[0],
      time: row[1],
      seedName: row[2],
      date: row[3],
      verified: row[4],
      video: row[5],
      comment: row[6],
      parsedDate: parseDate(row[3]),
      type: 'SSG',
    }));
}

function findRunner(runners, name) {
  const query = normalizeName(name);
  return runners.find(r => {
    const runnerName = normalizeName(r.name);
    return runnerName === query || runnerName.includes(query) || query.includes(runnerName);
  });
}

function findRuns(runs, name) {
  return runs.filter(r => normalizeName(r.name) === normalizeName(name));
}

function calculateEarnings(tournaments) {
  const map = new Map();
  for (const tournament of tournaments) {
    const winners = Array.isArray(tournament?.winners) ? tournament.winners : [];
    for (const winner of winners) {
      if (!Array.isArray(winner) || winner.length < 2) continue;
      const name = normalizeName(winner[0]);
      const amount = Number(winner[1]) || 0;
      if (!name || Number.isNaN(amount)) continue;
      map.set(name, (map.get(name) || 0) + amount);
    }
  }
  return map;
}

function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (!fs.existsSync(RANKED_CACHE_DIR)) {
      fs.mkdirSync(RANKED_CACHE_DIR, { recursive: true });
    }
  } catch (e) {
    logger.warn('Failed to create cache directory:', e);
  }
}

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    logger.warn(`Failed to read cache file ${filePath}:`, e);
    return null;
  }
}

function writeJsonFile(filePath, data) {
  try {
    ensureCacheDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    logger.warn(`Failed to write cache file ${filePath}:`, e);
  }
}

function isCacheFresh(filePath, ttlMs) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stats = fs.statSync(filePath);
    return Date.now() - stats.mtimeMs < ttlMs;
  } catch {
    return false;
  }
}

async function loadProfileCache(timeoutMs = 30000) {
  const cached = readJsonFile(PROFILE_CACHE_FILE);
  if (cached && isCacheFresh(PROFILE_CACHE_FILE, PROFILE_CACHE_TTL_MS)) {
    runnersCache = Array.isArray(cached.runners) ? cached.runners : [];
    rsgRunsCache = Array.isArray(cached.rsgRuns) ? cached.rsgRuns : [];
    ssgRunsCache = Array.isArray(cached.ssgRuns) ? cached.ssgRuns : [];
    profileCacheLoaded = runnersCache.length > 0;
    if (profileCacheLoaded) {
      writeTopLeaderboardMd();
      logger.info(`Profile cache loaded from disk: ${runnersCache.length} runners, ${rsgRunsCache.length} rsg runs, ${ssgRunsCache.length} ssg runs`);
      return;
    }
  }

  const results = await Promise.allSettled([
    fetchWithTimeout(ACTIONS.runners, timeoutMs),
    fetchWithTimeout(ACTIONS.rsg, timeoutMs),
    fetchWithTimeout(ACTIONS.ssg, timeoutMs),
  ]);

  if (results[0].status === 'fulfilled') runnersCache = parseRunners(results[0].value);
  else logger.warn('Failed to cache runners:', results[0].reason?.message || results[0].reason);

  if (results[1].status === 'fulfilled') rsgRunsCache = parseRsgRuns(results[1].value);
  else logger.warn('Failed to cache rsg runs:', results[1].reason?.message || results[1].reason);

  if (results[2].status === 'fulfilled') ssgRunsCache = parseSsgRuns(results[2].value);
  else logger.warn('Failed to cache ssg runs:', results[2].reason?.message || results[2].reason);

  profileCacheLoaded = runnersCache.length > 0;

  if (profileCacheLoaded || cached) {
    writeJsonFile(PROFILE_CACHE_FILE, {
      runners: runnersCache,
      rsgRuns: rsgRunsCache,
      ssgRuns: ssgRunsCache,
      cachedAt: Date.now(),
    });
  }

  writeTopLeaderboardMd();

  logger.info(`Profile cache loaded: ${runnersCache.length} runners, ${rsgRunsCache.length} rsg runs, ${ssgRunsCache.length} ssg runs`);
}

const EARNINGS_CACHE_FILE = path.join(CACHE_DIR, 'earnings_cache.json');
const EARNINGS_CACHE_TTL_MS = Number(process.env.EARNINGS_CACHE_TTL_MS) || ONE_DAY_MS;

async function loadEarningsCache(timeoutMs = 15000) {
  const cached = readJsonFile(EARNINGS_CACHE_FILE);
  if (cached && isCacheFresh(EARNINGS_CACHE_FILE, EARNINGS_CACHE_TTL_MS) && Array.isArray(cached.tournaments)) {
    earningsCache = calculateEarnings(cached.tournaments);
    logger.info(`Earnings cache loaded from disk for ${earningsCache.size} players`);
    return;
  }

  try {
    const data = await fetchWithTimeout(ACTIONS.earnings, timeoutMs);
    const tournaments = unwrapArray(data, ['tournaments', 'data', 'results', 'items']);
    writeJsonFile(EARNINGS_CACHE_FILE, { tournaments, cachedAt: Date.now() });
    earningsCache = calculateEarnings(tournaments);
    logger.info(`Earnings cache loaded for ${earningsCache.size} players`);
  } catch (e) {
    logger.error('Failed to load earnings cache:', e);
    if (cached && Array.isArray(cached.tournaments)) {
      earningsCache = calculateEarnings(cached.tournaments);
    } else {
      earningsCache = new Map();
    }
  }
}

function getEarnings(name) {
  return earningsCache.get(normalizeName(name)) || 0;
}

function colorToHex(color) {
  const map = {
    red: 0xe74c3c,
    blue: 0x3498db,
    green: 0x2ecc71,
    yellow: 0xf1c40f,
    orange: 0xe67e22,
    purple: 0x9b59b6,
    pink: 0xff9ff3,
    black: 0x2c3e50,
    white: 0xecf0f1,
    gray: 0x95a5a6,
    grey: 0x95a5a6,
    cyan: 0x00d2d3,
    lime: 0x7bed9f,
    brown: 0x8b4513,
    gold: 0xf9ca24,
    silver: 0xbdc3c7,
  };
  if (!color) return 0x00b894;
  const key = String(color).trim().toLowerCase();
  return map[key] ?? 0x00b894;
}

function formatDateShort(parsedDate, rawDate) {
  const date = toDate(parsedDate) || parseDate(rawDate);
  if (!date) return rawDate || '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function formatMs(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return null;
  const totalSeconds = Math.floor(Number(ms) / 1000);
  if (totalSeconds < 0) return null;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function stateFlagEmoji(state) {
  const key = state ? String(state).trim().toUpperCase() : '';
  if (!key) return '🇧🇷';
  return process.env[`STATE_EMOJI_${key}`] || process.env.STATE_EMOJI || '🇧🇷';
}

function emojiToUrl(emojiString) {
  const text = String(emojiString || '');
  const match = text.match(/<a?:[^:]+:(\d+)>/);
  if (!match) return null;
  const animated = text.startsWith('<a:');
  return `https://cdn.discordapp.com/emojis/${match[1]}.${animated ? 'gif' : 'png'}`;
}

function formatRunLine(run) {
  const lines = [];
  if (run.time) {
    const time = run.type === 'SSG'
      ? String(run.time).replace(/\.\d+.*$/, '')
      : run.time;
    lines.push(`${CLOCK_EMOJI} ${time}`);
  }
  const small = run.type === 'SSG'
    ? (run.seedName || formatDateShort(run.parsedDate, run.date))
    : formatDateShort(run.parsedDate, run.date);
  if (small) {
    lines.push(`-# ${small}`);
  }
  return lines.join('\n');
}

function formatRunsSection(runs, title, maxRuns = 5) {
  if (!Array.isArray(runs) || runs.length === 0) return null;
  const sorted = [...runs].sort((a, b) => {
    const aDate = toDate(a.parsedDate)?.getTime() || 0;
    const bDate = toDate(b.parsedDate)?.getTime() || 0;
    return bDate - aDate;
  });
  const shown = sorted.slice(0, maxRuns);
  const remaining = sorted.length - shown.length;
  let value = shown.map(r => formatRunLine(r)).join('\n');
  if (remaining > 0) value += `\n...e mais ${remaining} run(s).`;
  return { name: title, value, inline: false };
}

function normalizeProfile(name, runner, rsgRuns, rankedPb, rankedElo, errorNote = null) {
  return {
    name: runner?.name || name,
    state: runner?.state || '—',
    color: runner?.color || '—',
    uuid: runner?.uuid || null,
    rsgRuns,
    rankedPb,
    rankedElo,
    errorNote,
  };
}

function buildProfileEmbed(profile) {
  const color = colorToHex(profile.color);
  const stateFlag = stateFlagEmoji(profile.state);
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${LOGO_EMOJI} Perfil de ${profile.name} ${LOGO_EMOJI}`);

  if (isValidUuid(profile.uuid)) {
    const headUuid = String(profile.uuid).replace(/-/g, '');
    embed.setThumbnail(`https://mc-heads.net/head/${headUuid}`);
  }

  const rankedUrl = isValidUuid(profile.uuid) ? `https://mcsrranked.com/stats/${profile.uuid}` : null;
  const rankedField = rankedUrl
    ? { name: `${RANKED_EMOJI} Ranked:`, value: `\n[Perfil](${rankedUrl})`, inline: true }
    : null;
  const earnings = getEarnings(profile.name);
  const ganhosValue = earnings > 0 ? `R$ ${earnings.toLocaleString('pt-BR')}` : '—';
  const ganhosField = { name: `${COIN_EMOJI} Ganhos:`, value: ganhosValue, inline: true };

  if (rankedField) embed.addFields(rankedField);
  if (rankedField && ganhosField) {
    embed.addFields({ name: '\u200b', value: '\u200b', inline: true });
  }
  if (ganhosField) embed.addFields(ganhosField);

  const rsgField = formatRunsSection(profile.rsgRuns, `${BURIED_TREASURE_EMOJI} RSG 1.16:`);
  const rankedPbLines = [];
  if (profile.rankedPb) rankedPbLines.push(`${CLOCK_EMOJI} ${profile.rankedPb}`);
  if (profile.rankedElo !== null && profile.rankedElo !== undefined) rankedPbLines.push(`Elo: ${profile.rankedElo}`);
  const rankedPbValue = rankedPbLines.length > 0 ? rankedPbLines.join('\n') : null;
  const rankedPbField = rankedPbValue ? { name: `${RANKED_EMOJI} PB Ranked:`, value: rankedPbValue, inline: true } : null;

  if (rsgField && rankedPbField) {
    rsgField.inline = true;
    rankedPbField.inline = true;
  }

  if (rsgField) embed.addFields(rsgField);
  if (rsgField && rankedPbField) {
    embed.addFields({ name: '\u200b', value: '\u200b', inline: true });
  }
  if (rankedPbField) embed.addFields(rankedPbField);

  const footerText = profile.errorNote
    ? `${profile.errorNote} • ${MCSRBR_QUEUE_URL}`
    : MCSRBR_QUEUE_URL;
  embed.setFooter({ text: footerText, iconURL: emojiToUrl(LOGO_EMOJI) });

  embed.setTimestamp();
  return embed;
}

async function fetchWithTimeout(action, timeoutMs) {
  const url = buildApiUrl(action);
  logger.info(`fetchWithTimeout: fetching ${url} (timeout ${timeoutMs}ms)`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn(`fetchWithTimeout: non-OK status ${res.status} from ${url}`);
      throw new Error(`A API retornou um erro (${action}): ${res.status}.`);
    }

    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      throw new Error(`Timeout ao buscar ${action}.`);
    }
    logger.error(`fetchWithTimeout: fetch failed for ${action}:`, e);
    throw new Error(`Falha ao conectar com a API (${action}).`);
  }
}

async function fetchProfile(name) {
  if (!profileCacheLoaded) {
    await loadProfileCache();
  }

  const runner = findRunner(runnersCache, name);
  const resolvedName = runner?.name || name;
  const matchingRsg = findRuns(rsgRunsCache, resolvedName);
  const matchingSsg = findRuns(ssgRunsCache, resolvedName);

  if (!runner && matchingRsg.length === 0 && matchingSsg.length === 0) {
    throw new Error('Runner não encontrado.');
  }

  let rankedPb = null;
  let rankedElo = null;
  if (isValidUuid(runner?.uuid)) {
    try {
      const rankedData = await fetchRankedStats(runner.uuid);
      rankedPb = formatMs(rankedData?.data?.statistics?.total?.bestTime?.ranked);
      rankedElo = rankedData?.data?.eloRate ?? null;
    } catch (e) {
      logger.warn('Failed to fetch ranked stats:', e);
    }
  }

  return normalizeProfile(name, runner, matchingRsg, rankedPb, rankedElo, null);
}

async function fetchRankedStats(uuid, timeoutMs = 10000) {
  if (!isValidUuid(uuid)) {
    throw new Error(`UUID inválido para ranked stats: ${uuid}`);
  }
  const cleanUuid = String(uuid).replace(/-/g, '');
  const url = `${RANKED_API_BASE}/${cleanUuid}`;
  logger.info(`fetchRankedStats: fetching ${url} (timeout ${timeoutMs}ms)`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn(`fetchRankedStats: non-OK status ${res.status} from ${url}`);
      throw new Error(`A API ranked retornou um erro: ${res.status}.`);
    }

    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      throw new Error('Timeout ao buscar ranked stats.');
    }
    logger.error(`fetchRankedStats: fetch failed for ${uuid}:`, e);
    throw new Error('Falha ao conectar com a API ranked.');
  }
}

function rankedCachePath(key) {
  return path.join(RANKED_CACHE_DIR, `${key}.json`);
}

async function getRankedStatsByUuid(uuid) {
  if (!isValidUuid(uuid)) {
    logger.warn(`getRankedStatsByUuid: invalid uuid ${uuid}`);
    return null;
  }
  const key = String(uuid).replace(/-/g, '');
  const filePath = rankedCachePath(key);

  if (isCacheFresh(filePath, RANKED_CACHE_TTL_MS)) {
    const cached = readJsonFile(filePath);
    if (cached && cached.data) {
      rankedStatsCache.set(key, { ts: cached.ts || Date.now(), data: cached.data });
      return cached.data;
    }
  }

  try {
    const data = await fetchRankedStats(uuid);
    const ts = Date.now();
    rankedStatsCache.set(key, { ts, data });
    writeJsonFile(filePath, { ts, data });
    return data;
  } catch (e) {
    logger.warn(`getRankedStatsByUuid: failed for ${uuid}:`, e);
    const stale = readJsonFile(filePath);
    if (stale && stale.data) return stale.data;
    return null;
  }
}

function parseTimeToMs(value) {
  if (!value) return null;
  const text = String(value).trim();
  const parts = text.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return null;
}

function findRunnerNamesInText(text) {
  const normalizedText = normalizeName(text);
  const found = new Set();

  const words = Array.from(new Set((normalizedText.match(/[a-z0-9_]+/g) || [])));

  for (const runner of runnersCache) {
    const runnerName = normalizeName(runner.name);
    if (!runnerName || runnerName.length < 2) continue;

    if (normalizedText.includes(runnerName)) {
      found.add(runner.name);
      continue;
    }

    for (const word of words) {
      if (word.length >= 3 && runnerName.startsWith(word)) {
        found.add(runner.name);
        break;
      }
    }
  }

  for (const run of rsgRunsCache) {
    const runName = normalizeName(run.name);
    if (!runName || runName.length < 2) continue;

    if (normalizedText.includes(runName)) {
      found.add(run.name);
      continue;
    }

    for (const word of words) {
      if (word.length >= 3 && runName.startsWith(word)) {
        found.add(run.name);
        break;
      }
    }
  }

  return Array.from(found);
}

async function getRunnerLiveContext(name) {
  if (!profileCacheLoaded) {
    await loadProfileCache();
  }

  const runner = findRunner(runnersCache, name);
  const resolvedName = runner?.name || name;

  const rsgRuns = findRuns(rsgRunsCache, resolvedName);
  const hasRunner = !!runner;
  const hasRsg = rsgRuns.length > 0;

  if (!hasRunner && !hasRsg) return null;

  const lines = [];
  lines.push(`Nome: ${resolvedName}`);
  if (runner?.state) lines.push(`Estado: ${runner.state}`);

  const earnings = getEarnings(resolvedName);
  if (earnings > 0) lines.push(`Ganhos: R$ ${earnings.toLocaleString('pt-BR')}`);

  if (hasRsg) {
    const sortedByTime = [...rsgRuns].sort((a, b) => {
      const ta = parseTimeToMs(a.time) ?? Infinity;
      const tb = parseTimeToMs(b.time) ?? Infinity;
      return ta - tb;
    });
    const pb = sortedByTime[0];
    lines.push(`RSG PB: ${pb.time} (${pb.bastion || ''})${pb.comment ? ` — ${pb.comment}` : ''}`);
  }

  if (isValidUuid(runner?.uuid)) {
    const rankedData = await getRankedStatsByUuid(runner.uuid);
    if (rankedData) {
      const pb = formatMs(rankedData?.data?.statistics?.total?.bestTime?.ranked);
      const elo = rankedData?.data?.eloRate;
      if (pb) lines.push(`Ranked PB: ${pb}`);
      if (elo !== null && elo !== undefined) lines.push(`Ranked Elo: ${elo}`);
    }
  }

  return { name: resolvedName, context: lines.join('\n') };
}

function writeTopLeaderboardMd() {
  try {
    const TOP_LEADERBOARD_FILE = path.resolve(__dirname, '../data/rag/top.md');
    const limit = 10;

    const rsg = rsgRunsCache
      .filter(r => r.time && r.verified !== false && r.verified !== 'FALSE')
      .map(r => ({ ...r, ms: parseTimeToMs(r.time) }))
      .filter(r => r.ms !== null && r.ms > 0)
      .sort((a, b) => a.ms - b.ms)
      .slice(0, limit);

    const ssg = ssgRunsCache
      .filter(r => r.time && r.verified !== false && r.verified !== 'FALSE')
      .map(r => ({ ...r, ms: parseTimeToMs(r.time) }))
      .filter(r => r.ms !== null && r.ms > 0)
      .sort((a, b) => a.ms - b.ms)
      .slice(0, limit);

    let md = 'Top runs do leaderboard (cache local):\n\n';
    md += 'RSG 1.16:\n';
    rsg.forEach((r, i) => {
      md += `${i + 1}. ${r.name}: ${r.time}${r.bastion ? ` (${r.bastion})` : ''}\n`;
    });

    md += '\nSSG 1.16:\n';
    ssg.forEach((r, i) => {
      md += `${i + 1}. ${r.name}: ${r.time}${r.seedName ? ` (${r.seedName})` : ''}\n`;
    });

    fs.writeFileSync(TOP_LEADERBOARD_FILE, md, 'utf-8');
  } catch (e) {
    logger.warn('Failed to write top leaderboard RAG file:', e);
  }
}

function isProfileCacheLoaded() {
  return profileCacheLoaded;
}

module.exports = {
  fetchProfile,
  buildProfileEmbed,
  normalizeProfile,
  buildApiUrl,
  colorToHex,
  loadEarningsCache,
  getEarnings,
  loadProfileCache,
  getRunnerLiveContext,
  findRunnerNamesInText,
  profileCacheLoaded,
  isProfileCacheLoaded,
};
