const { readJson, writeJson } = require('./store');
const logger = require('./logger');

const BETS_FILE = 'bets.json';
const EVENTS_CACHE_FILE = 'events.json';

function loadBets() {
  return readJson(BETS_FILE, []);
}

function saveBets(bets) {
  writeJson(BETS_FILE, bets);
}

function loadEventsCache() {
  return readJson(EVENTS_CACHE_FILE, { updatedAt: 0, items: [] });
}

function saveEventsCache(cache) {
  writeJson(EVENTS_CACHE_FILE, cache);
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { 'accept': 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (e) {
    logger.warn('betting.fetchJson error:', e?.message || e);
    return null;
  }
}

async function refreshEvents() {
  const { GOOGLE_BETS_API_URL } = process.env;
  if (!GOOGLE_BETS_API_URL) return loadEventsCache().items;
  const data = await fetchJson(GOOGLE_BETS_API_URL);
  let items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
  // Normalize: ensure [{ id, title, options: ["A","B",...], closesAt }]
  items = items.map((e) => ({
    id: String(e.id ?? e.eventId ?? e.key ?? e.slug ?? e.title ?? e.name ?? Math.random().toString(36).slice(2)),
    title: String(e.title ?? e.name ?? `Event ${e.id ?? e.eventId ?? ''}`),
    options: Array.isArray(e.options)
      ? e.options.map(String)
      : [e.optionA, e.optionB, e.optionC, e.optionD].filter(Boolean).map(String),
    closesAt: e.closesAt ?? e.closeAt ?? e.deadline ?? null,
  })).filter(ev => Array.isArray(ev.options) && ev.options.length >= 2);
  const cache = { updatedAt: Date.now(), items };
  saveEventsCache(cache);
  return items;
}

function listOpenEvents(now = Date.now()) {
  const { items } = loadEventsCache();
  return items.filter((e) => !e.closesAt || new Date(e.closesAt).getTime() > now);
}

function getEventById(eventId) {
  const { items } = loadEventsCache();
  return items.find((e) => String(e.id) === String(eventId));
}

function placeBet({ userId, eventId, option, amount }) {
  if (!userId || !eventId || !option || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid bet parameters');
  }
  const ev = getEventById(eventId);
  if (!ev) throw new Error('Event not found');
  const now = Date.now();
  if (ev.closesAt && new Date(ev.closesAt).getTime() <= now) throw new Error('Betting closed for this event');
  if (!ev.options.includes(option)) throw new Error('Invalid option for this event');

  const bets = loadBets();
  const id = `${eventId}:${userId}:${Date.now()}`;
  const bet = { id, userId, eventId: String(eventId), option: String(option), amount: Math.floor(amount * 100) / 100, createdAt: now, settled: false };
  bets.push(bet);
  saveBets(bets);
  return bet;
}

function getUserBets(userId, { includeSettled = false } = {}) {
  const bets = loadBets();
  return bets.filter(b => b.userId === userId && (includeSettled || !b.settled));
}

function totalsForEvent(eventId) {
  const bets = loadBets();
  const active = bets.filter(b => b.eventId === String(eventId) && !b.settled);
  const optionTotals = active.reduce((acc, b) => {
    acc[b.option] = (acc[b.option] || 0) + b.amount;
    return acc;
  }, {});
  const totalAll = Object.values(optionTotals).reduce((a, b) => a + b, 0);
  return { optionTotals, totalAll };
}

function computePayoutsForEvent(eventId, winnerOption) {
  const bets = loadBets();
  const evBets = bets.filter(b => b.eventId === String(eventId) && !b.settled);
  const totals = evBets.reduce((acc, b) => {
    acc[b.option] = (acc[b.option] || 0) + b.amount;
    return acc;
  }, {});
  const totalOnWinner = totals[winnerOption] || 0;
  const totalAll = Object.values(totals).reduce((a, b) => a + b, 0);
  const totalOnLosers = Math.max(0, totalAll - totalOnWinner);
  return { evBets, totalOnWinner, totalOnLosers };
}

function settleEvent(eventId, winnerOption, creditFn) {
  const bets = loadBets();
  const { evBets, totalOnWinner, totalOnLosers } = computePayoutsForEvent(eventId, winnerOption);
  if (evBets.length === 0) return 0;

  let settledCount = 0;
  for (const b of bets) {
    if (b.eventId !== String(eventId) || b.settled) continue;
    if (b.option === String(winnerOption)) {
      let bonus = 0;
      if (totalOnWinner > 0) {
        bonus = (b.amount / totalOnWinner) * totalOnLosers; // proportional share of losers' pool
      }
      const payout = Math.floor((b.amount + bonus) * 100) / 100;
      if (typeof creditFn === 'function') creditFn(b.userId, payout);
      b.payout = payout;
    } else {
      b.payout = 0;
    }
    b.settled = true;
    b.settledAt = Date.now();
    settledCount++;
  }
  saveBets(bets);
  return settledCount;
}

module.exports = {
  refreshEvents,
  listOpenEvents,
  getEventById,
  placeBet,
  getUserBets,
  settleEvent,
  computePayoutsForEvent,
  totalsForEvent,
};
