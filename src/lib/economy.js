const { readJson, writeJson } = require('./store');

const ECON_FILE = 'economy.json';
const STARTING_BALANCE = Number(process.env.STARTING_BALANCE || 1000);

function load() {
  return readJson(ECON_FILE, {});
}

function save(db) {
  writeJson(ECON_FILE, db);
}

function getRecord(userId) {
  const db = load();
  if (!db[userId]) {
    db[userId] = { balance: STARTING_BALANCE, won: 0, lost: 0 };
    save(db);
  }
  return db[userId];
}

function getBalance(userId) {
  return getRecord(userId).balance;
}

function addBalance(userId, delta) {
  const db = load();
  if (!db[userId]) db[userId] = { balance: STARTING_BALANCE, won: 0, lost: 0 };
  const rec = db[userId];
  rec.balance = Math.max(0, Math.floor((rec.balance + delta) * 100) / 100);
  if (delta > 0) rec.won = (rec.won || 0) + delta;
  if (delta < 0) rec.lost = (rec.lost || 0) + Math.abs(delta);
  save(db);
  return rec.balance;
}

function ensureUser(userId) {
  getRecord(userId);
}

function top(n = 10) {
  const db = load();
  return Object.entries(db)
    .map(([userId, rec]) => ({ userId, ...rec }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, n);
}

module.exports = { getBalance, addBalance, ensureUser, top };
