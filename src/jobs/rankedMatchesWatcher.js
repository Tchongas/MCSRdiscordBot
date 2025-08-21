const { EmbedBuilder } = require('discord.js');
const logger = require('../lib/logger');
const { createIntervalJob } = require('../lib/jobs');
const { loadPostedSet, savePostedSet } = require('../lib/postCache');

// Posted IDs persisted to disk to avoid reposts across restarts
const postedSet = loadPostedSet();
// Guard for concurrent runs to avoid duplicate sends within the same process window
const inFlight = new Set();

function rememberPosted(id) {
  if (postedSet.has(id)) return;
  postedSet.add(id);
  // Persist best-effort; ignore errors
  try { savePostedSet(postedSet); } catch {}
}

function isBrazil(country) {
  if (!country) return false;
  return String(country).toLowerCase() === 'br' || String(country).toLowerCase() === 'bra';
}

function formatDuration(msOrSec) {
  // Heuristic: typical match is minutes. If value < 100000 (≈27.7h) treat as seconds; else milliseconds.
  const v = Number(msOrSec);
  if (!Number.isFinite(v)) return '—';
  const ms = v < 100000 ? v * 1000 : v;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function countryFlag(country) {
  if (!country) return '🌐';
  const code = String(country).toUpperCase();
  if (code.length !== 2) return code;
  // Regional indicator symbols A-Z start at 0x1F1E6
  const A = 0x1F1E6;
  const first = A + (code.charCodeAt(0) - 65);
  const second = A + (code.charCodeAt(1) - 65);
  return String.fromCodePoint(first) + String.fromCodePoint(second);
}

function eloLineFor(match, uuid, fallbackRate) {
  // Try to compute "before → after (±delta)"
  const changes = Array.isArray(match?.changes) ? match.changes : [];
  const rec = changes.find(c => c?.uuid === uuid);
  const change = rec?.change;
  const after = rec?.eloRate ?? fallbackRate;
  if (typeof change === 'number' && Number.isFinite(change) && typeof after === 'number' && Number.isFinite(after)) {
    const before = after - change;
    const sign = change > 0 ? `+${change}` : `${change}`;
    return ` \`$${before} → ${after} (${sign})\``.replace('$','');
  }
  if (typeof after === 'number' && Number.isFinite(after)) {
    return ` \`${after}\``;
  }
  return '';
}

function buildMatchEmbed(match) {
  const seed = match.seed || {};
  const players = Array.isArray(match.players) ? match.players : [];
  const winnerUuid = match?.result?.uuid || null;
  const hasWinner = Boolean(winnerUuid);
  const isForfeit = Boolean(match.forfeited);
  const isDraw = !isForfeit && !hasWinner; // no winner and not forfeited -> treat as draw

  const winner = hasWinner ? (players.find(p => p.uuid === winnerUuid) || null) : null;
  const loser = hasWinner ? (players.find(p => p.uuid !== winnerUuid) || null) : null;

  // Brazil-aware color logic
  const p1 = players[0];
  const p2 = players[1];
  const p1IsBR = isBrazil(p1?.country);
  const p2IsBR = isBrazil(p2?.country);
  const anyBR = p1IsBR || p2IsBR;
  const bothBR = p1IsBR && p2IsBR;

  let color;
  if (isDraw && anyBR) {
    color = 0xF1C40F; // yellow for draws
  } else if (bothBR) {
    color = 0x5DADE2; // light blue if both Brazilian (non-draw)
  } else if (anyBR && hasWinner) {
    const brazilWinner = (p1IsBR && winnerUuid === p1?.uuid) || (p2IsBR && winnerUuid === p2?.uuid);
    color = brazilWinner ? 0x2ECC71 : 0xE74C3C; // green if BR wins, red if BR loses
  } else {
    // default fallback based on type
    color = isForfeit ? 0xFFA500 : (isDraw ? 0xF1C40F : 0x2ECC71);
  }
  const title = isDraw ? '⚖️ MCSR Ranked (Empate)' : (isForfeit ? '🏳️ MCSR Ranked (Forfeit)' : '🏆 MCSR Ranked');

  // p1/p2 already defined above

  const p1IsWinner = Boolean(winner && winner.uuid === p1?.uuid);
  const p2IsWinner = Boolean(winner && winner.uuid === p2?.uuid);
  const p1Suffix = isDraw ? '' : (p1IsWinner ? (isForfeit ? ' — 🏆 (forfeit)' : ' — 🏆') : (isForfeit && p1 && loser && p1.uuid === loser.uuid ? ' — 🏳️ Forfeit' : ''));
  const p2Suffix = isDraw ? '' : (p2IsWinner ? (isForfeit ? ' — 🏆 (forfeit)' : ' — 🏆') : (isForfeit && p2 && loser && p2.uuid === loser.uuid ? ' — 🏳️ Forfeit' : ''));
  const p1Name = p1 ? (p1IsWinner ? `**${p1.nickname || '???'}**` : `${p1.nickname || '???'}`) : '—';
  const p2Name = p2 ? (p2IsWinner ? `**${p2.nickname || '???'}**` : `${p2.nickname || '???'}`) : '—';
  const p1Elo = p1 ? eloLineFor(match, p1.uuid, p1.eloRate) : '';
  const p2Elo = p2 ? eloLineFor(match, p2.uuid, p2.eloRate) : '';
  const p1Line = p1 ? `${countryFlag(p1.country)} ${p1Name}${p1Suffix}${p1Elo}` : '—';
  const p2Line = p2 ? `${countryFlag(p2.country)} ${p2Name}${p2Suffix}${p2Elo}` : '—';

  const desc = `• ${p1Line}\n• ${p2Line}`;

  const seedOver = seed.overworld || '—';
  const seedBastion = seed.nether || seed.bastionType || '—';
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(desc)
    .addFields(
      { name: '⏱️ Tempo', value: formatDuration(match?.result?.time), inline: true },
      { name: '🌱 Seed', value: `Overworld: \`${seedOver}\`\nBastion: \`${seedBastion}\``, inline: true },
    )
    .setFooter({ text: `Match ID: ${match.id}` });

  // Timestamp
  if (match.date) {
    const ts = Number(match.date);
    const ms = ts < 9999999999 ? ts * 1000 : ts; // support seconds or ms
    embed.setTimestamp(new Date(ms));
  }

  return embed;
}

async function runRankedWatcher(client) {
  const { RANKED_API_URL, RANKED_POLL_MS, RANKED_ANNOUNCE_CHANNEL_ID } = process.env;
  if (!RANKED_API_URL || !RANKED_ANNOUNCE_CHANNEL_ID) {
    logger.warn('rankedMatchesWatcher: missing RANKED_API_URL or RANKED_ANNOUNCE_CHANNEL_ID; skipping');
    return;
  }
  const debug = /^1|true|yes$/i.test(String(process.env.RANKED_DEBUG || ''));

  logger.info(`rankedMatchesWatcher: fetching ${RANKED_API_URL}`);

  let res;
  try {
    res = await fetch(RANKED_API_URL, { headers: { 'accept': 'application/json' } });
  } catch (e) {
    logger.error('rankedMatchesWatcher: fetch failed:', e);
    return;
  }

  if (!res.ok) {
    logger.warn(`rankedMatchesWatcher: non-OK status ${res.status}`);
    return;
  }
  logger.info(`rankedMatchesWatcher: fetch OK ${res.status}`);

  let data;
  try {
    data = await res.json();
  } catch (e) {
    logger.error('rankedMatchesWatcher: failed to parse JSON:', e);
    return;
  }
  // Support APIs that wrap results (e.g., { status, data: [...] } or { items: [...] })
  if (!Array.isArray(data)) {
    const unwrapOrder = ['data', 'items', 'results', 'matches'];
    for (const key of unwrapOrder) {
      if (data && Array.isArray(data[key])) {
        logger.info(`rankedMatchesWatcher: unwrapped '${key}' array from response object`);
        data = data[key];
        break;
      }
    }
  }

  if (!Array.isArray(data) || data.length === 0) {
    logger.info('rankedMatchesWatcher: response has no items after parsing');
    return;
  }
  logger.info(`rankedMatchesWatcher: received ${data.length} items`);
  if (debug) {
    try {
      const preview = JSON.stringify(data.slice(0, 3), null, 2).slice(0, 1500);
      logger.info('rankedMatchesWatcher: payload preview (first 3):\n' + preview);
    } catch {}
  }

  // We expect an array of matches; iterate most recent first or last; sort by date ascending so we post in order
  const matches = [...data].sort((a, b) => Number(a.date || 0) - Number(b.date || 0));
  if (debug) {
    const first = matches[0]?.date; const last = matches[matches.length - 1]?.date;
    const toIso = (v) => v ? new Date((Number(v) < 9999999999 ? Number(v) * 1000 : Number(v))).toISOString() : '—';
    logger.info(`rankedMatchesWatcher: sorted. earliest=${toIso(first)} latest=${toIso(last)}`);
  }

  const channel = await client.channels
    .fetch(RANKED_ANNOUNCE_CHANNEL_ID)
    .catch(err => { logger.warn(`rankedMatchesWatcher: failed to fetch channel ${RANKED_ANNOUNCE_CHANNEL_ID}: ${err?.message || err}`); return null; });
  if (!channel) {
    logger.warn(`rankedMatchesWatcher: could not resolve channel id=${RANKED_ANNOUNCE_CHANNEL_ID}`);
    return;
  }
  const typeName = channel.constructor?.name || 'Unknown';
  const guildId = channel.guildId || 'DM/none';
  logger.info(`rankedMatchesWatcher: resolved channel id=${channel.id} type=${typeName} guild=${guildId}`);
  if (!channel.isTextBased()) {
    logger.warn(`rankedMatchesWatcher: channel ${channel.id} is not text-based (type=${typeName})`);
    return;
  }

  const newlyPosted = [];
  let considered = 0;
  let skippedDup = 0;

  for (const match of matches) {
    const id = match && match.id;
    if (id == null) continue;
    considered++;
    if (postedSet.has(id) || inFlight.has(id)) { skippedDup++; continue; } // already posted or being posted
    inFlight.add(id);

    const players = Array.isArray(match.players) ? match.players : [];
    // Brazil-only filter: only post if at least one player is Brazilian
    const anyBR = players.some(p => isBrazil(p?.country));
    if (!anyBR) { inFlight.delete(id); continue; }

    // Build and send embed
    try {
      const embed = buildMatchEmbed(match);
      await channel.send({ embeds: [embed] });
      rememberPosted(id);
      newlyPosted.push(id);
    } catch (e) {
      logger.error(`rankedMatchesWatcher: failed to send for match ${id}:`, e);
    } finally {
      inFlight.delete(id);
    }
  }

  logger.info(`rankedMatchesWatcher: done. considered=${considered} posted=${newlyPosted.length} skippedDup=${skippedDup}`);
}

module.exports = {
  async register({ register }) {
    const intervalMs = Number(process.env.RANKED_POLL_MS) || 60000;
    register(
      createIntervalJob({
        name: 'rankedMatchesWatcher',
        intervalMs,
        run: runRankedWatcher,
      })
    );
  },
};
