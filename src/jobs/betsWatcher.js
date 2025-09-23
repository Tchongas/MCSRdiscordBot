const logger = require('../lib/logger');
const { createIntervalJob } = require('../lib/jobs');
const betting = require('../lib/betting');
const economy = require('../lib/economy');

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { 'accept': 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    logger.warn('betsWatcher.fetchJson error:', e?.message || e);
    return null;
  }
}

async function runBetsWatcher(client) {
  const { GOOGLE_BETS_API_URL, GOOGLE_RESULTS_API_URL } = process.env;

  // Refresh events cache (best effort)
  if (GOOGLE_BETS_API_URL) {
    try {
      await betting.refreshEvents();
    } catch (e) {
      logger.warn('betsWatcher: refreshEvents failed:', e);
    }
  }

  // Settle results (best effort)
  if (!GOOGLE_RESULTS_API_URL) return;
  const data = await fetchJson(GOOGLE_RESULTS_API_URL);
  if (!data) return;
  const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
  for (const r of items) {
    // Normalize expected fields
    const eventId = String(r.eventId ?? r.id ?? r.key ?? r.slug ?? '');
    const winner = r.winner ?? r.winnerOption ?? r.result ?? r.outcome ?? null;
    const settled = Boolean(r.settled ?? r.isSettled ?? false);
    if (!eventId || !winner || !settled) continue;

    try {
      const count = betting.settleEvent(eventId, String(winner), (userId, payout) => {
        economy.addBalance(userId, payout);
      });
      if (count > 0) logger.info(`betsWatcher: settled event ${eventId} → '${winner}', bets settled: ${count}`);
    } catch (e) {
      logger.warn(`betsWatcher: failed to settle event ${eventId}:`, e?.message || e);
    }
  }
}

module.exports = {
  async register({ register }) {
    const intervalMs = Number(process.env.BETS_POLL_MS) || 30000;
    register(
      createIntervalJob({
        name: 'betsWatcher',
        intervalMs,
        run: runBetsWatcher,
      })
    );
  },
};
