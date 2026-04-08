const { EmbedBuilder } = require('discord.js');
const logger = require('../lib/logger');
const { createIntervalJob } = require('../lib/jobs');
const { loadPostedPaymentsSet, savePostedPaymentsSet } = require('../lib/livepixCache');

const postedSet = loadPostedPaymentsSet();
const inFlight = new Set();

function rememberPosted(id) {
  if (postedSet.has(id)) return;
  postedSet.add(id);
  try { savePostedPaymentsSet(postedSet); } catch {}
}

function normalizePaymentsPayload(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function paymentIdOf(payment) {
  return String(payment?.id || payment?.proof || payment?.reference || '');
}

function toCurrencyAmount(amount, currency = 'BRL') {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  const normalized = value >= 100 ? value / 100 : value;
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(normalized);
  } catch {
    return `${normalized.toFixed(2)} ${currency}`;
  }
}

function pickDisplayName(payment) {
  return payment?.name || payment?.senderName || payment?.from?.name || payment?.customer?.name || 'Anônimo';
}

function pickMessage(payment) {
  return payment?.message || payment?.comment || payment?.metadata?.message || payment?.description || null;
}

function paymentTimestamp(payment) {
  return payment?.createdAt || payment?.created_at || payment?.date || payment?.paidAt || null;
}

function buildPaymentEmbed(payment) {
  const amount = toCurrencyAmount(payment?.amount, payment?.currency || 'BRL');
  const name = pickDisplayName(payment);
  const message = pickMessage(payment);
  const reference = payment?.reference || '—';
  const proof = payment?.proof || '—';
  const currency = payment?.currency || 'BRL';

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('Novo pagamento recebido')
    .addFields(
      { name: 'Nome', value: String(name), inline: true },
      { name: 'Valor', value: amount, inline: true },
      { name: 'Moeda', value: String(currency), inline: true },
      { name: 'Referência', value: String(reference).slice(0, 1024), inline: false },
      { name: 'Comprovante', value: String(proof).slice(0, 1024), inline: false }
    )
    .setFooter({ text: `Payment ID: ${paymentIdOf(payment)}` });

  if (message) {
    embed.setDescription(String(message).slice(0, 4096));
  }

  const ts = paymentTimestamp(payment);
  if (ts) {
    const date = new Date(ts);
    if (!Number.isNaN(date.getTime())) embed.setTimestamp(date);
  }

  return embed;
}

async function fetchPayments(apiUrl, accessToken) {
  const res = await fetch(apiUrl, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`LivePix returned ${res.status}`);
  }

  return await res.json();
}

async function runLivePixWatcher(client) {
  const { LIVEPIX_PAYMENTS_API_URL, LIVEPIX_ACCESS_TOKEN, LIVEPIX_ANNOUNCE_CHANNEL_ID } = process.env;

  if (!LIVEPIX_PAYMENTS_API_URL || !LIVEPIX_ACCESS_TOKEN || !LIVEPIX_ANNOUNCE_CHANNEL_ID) {
    logger.warn('livepixWatcher: missing LIVEPIX_PAYMENTS_API_URL, LIVEPIX_ACCESS_TOKEN, or LIVEPIX_ANNOUNCE_CHANNEL_ID; skipping');
    return;
  }

  let data;
  try {
    data = await fetchPayments(LIVEPIX_PAYMENTS_API_URL, LIVEPIX_ACCESS_TOKEN);
  } catch (error) {
    logger.error('livepixWatcher: fetch failed:', error);
    return;
  }

  const payments = normalizePaymentsPayload(data)
    .filter(Boolean)
    .sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());

  if (payments.length === 0) {
    logger.info('livepixWatcher: no payments returned');
    return;
  }

  const channel = await client.channels
    .fetch(LIVEPIX_ANNOUNCE_CHANNEL_ID)
    .catch(err => { logger.warn(`livepixWatcher: failed to fetch channel ${LIVEPIX_ANNOUNCE_CHANNEL_ID}: ${err?.message || err}`); return null; });

  if (!channel || !channel.isTextBased()) {
    logger.warn(`livepixWatcher: invalid channel ${LIVEPIX_ANNOUNCE_CHANNEL_ID}`);
    return;
  }

  let posted = 0;
  let skippedDup = 0;

  for (const payment of payments) {
    const id = paymentIdOf(payment);
    if (!id) continue;
    if (postedSet.has(id) || inFlight.has(id)) {
      skippedDup++;
      continue;
    }

    inFlight.add(id);
    try {
      const embed = buildPaymentEmbed(payment);
      await channel.send({ embeds: [embed] });
      rememberPosted(id);
      posted++;
    } catch (error) {
      logger.error(`livepixWatcher: failed to send payment ${id}:`, error);
    } finally {
      inFlight.delete(id);
    }
  }

  logger.info(`livepixWatcher: done. received=${payments.length} posted=${posted} skippedDup=${skippedDup}`);
}

module.exports = {
  async register({ register }) {
    const intervalMs = Number(process.env.LIVEPIX_POLL_MS) || 15000;
    register(
      createIntervalJob({
        name: 'livepixWatcher',
        intervalMs,
        run: runLivePixWatcher,
      })
    );
  },
};
