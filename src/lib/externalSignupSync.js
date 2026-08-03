const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const logger = require('./logger');

const QUEUE_FILE = path.resolve(__dirname, '../../data/external-signup-queue.json');
const BASE_RETRY_MS = 30_000;
const MAX_RETRY_MS = 60 * 60 * 1000;
const BATCH_SIZE = 20;

let isProcessing = false;
let queue = loadQueue();

function ensureDataDir() {
  const dir = path.dirname(QUEUE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadQueue() {
  ensureDataDir();
  if (!fs.existsSync(QUEUE_FILE)) return [];
  try {
    const raw = fs.readFileSync(QUEUE_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.error('Failed to load external signup queue:', e);
    return [];
  }
}

function saveQueue() {
  ensureDataDir();
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
  } catch (e) {
    logger.error('Failed to save external signup queue:', e);
  }
}

function getEndpoint() {
  return process.env.EXTERNAL_SIGNUP_ENDPOINT || null;
}

function getToken() {
  return process.env.EXTERNAL_SIGNUP_TOKEN || null;
}

function postJson(urlString, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const body = JSON.stringify(payload);
    const token = getToken();
    const options = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    if (token) options.headers.Authorization = `Bearer ${token}`;

    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data || 'No body'}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15_000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(body);
    req.end();
  });
}

async function pushToExternal(entry) {
  const endpoint = getEndpoint();
  if (!endpoint) return true;

  const payload = {
    type: entry.type,
    slug: entry.slug,
    userId: entry.userId,
    displayName: entry.displayName,
    values: entry.values || {},
    sentAt: new Date().toISOString(),
  };

  await postJson(endpoint, payload);
  return true;
}

function scheduleEntry(type, slug, userId, displayName, values) {
  const endpoint = getEndpoint();
  if (!endpoint) return;

  const key = `${type}:${slug}:${userId}`;
  const existing = queue.find(item => item.key === key);
  const now = Date.now();

  if (existing) {
    existing.type = type;
    existing.displayName = displayName || existing.displayName;
    existing.values = values || {};
    existing.attempts = 0;
    existing.nextRetryAt = now;
  } else {
    queue.push({
      key,
      type,
      slug,
      userId,
      displayName: displayName || '',
      values: values || {},
      attempts: 0,
      nextRetryAt: now,
      createdAt: new Date().toISOString(),
    });
  }

  saveQueue();
  triggerFlush();
}

function scheduleSignupSync(slug, userId, displayName, values) {
  scheduleEntry('upsert', slug, userId, displayName, values);
}

function scheduleSignupRemoval(slug, userId, displayName) {
  scheduleEntry('delete', slug, userId, displayName, {});
}

function triggerFlush() {
  // Run asynchronously without blocking the caller.
  setImmediate(() => {
    processQueue().catch(e => logger.error('External signup sync flush failed:', e));
  });
}

function nextRetryTime(attempts) {
  const delay = Math.min(BASE_RETRY_MS * 2 ** attempts, MAX_RETRY_MS);
  return Date.now() + delay;
}

async function processQueue() {
  if (isProcessing) return;
  if (!getEndpoint()) return;
  if (queue.length === 0) return;

  isProcessing = true;
  const now = Date.now();
  const due = queue.filter(item => item.nextRetryAt <= now).slice(0, BATCH_SIZE);

  for (const item of due) {
    try {
      await pushToExternal(item);
      queue = queue.filter(q => q.key !== item.key);
      saveQueue();
    } catch (error) {
      logger.warn(`External signup push failed for ${item.key}: ${error.message}`);
      item.attempts += 1;
      item.nextRetryAt = nextRetryTime(item.attempts);
      saveQueue();
    }
  }

  isProcessing = false;
}

function startExternalSignupSync(intervalMs = 30_000) {
  if (!getEndpoint()) {
    logger.info('External signup sync disabled: EXTERNAL_SIGNUP_ENDPOINT not set.');
    return;
  }

  processQueue().catch(e => logger.error('Initial external signup sync failed:', e));
  const interval = setInterval(() => {
    processQueue().catch(e => logger.error('External signup sync interval failed:', e));
  }, intervalMs);

  // Prevent hanging the process if it's trying to exit cleanly.
  interval.unref();
}

module.exports = {
  scheduleSignupSync,
  scheduleSignupRemoval,
  startExternalSignupSync,
};
