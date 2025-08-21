const fs = require('fs');
const path = require('path');
const logger = require('./logger');

let registered = [];
let stopFns = [];

function loadJobs() {
  const jobsPath = path.join(__dirname, '..', 'jobs');
  if (!fs.existsSync(jobsPath)) return [];
  const files = fs.readdirSync(jobsPath).filter(f => f.endsWith('.js'));
  const mods = [];
  for (const file of files) {
    const filePath = path.join(jobsPath, file);
    delete require.cache[require.resolve(filePath)];
    const mod = require(filePath);
    if (mod && typeof mod.register === 'function') {
      mods.push(mod);
      logger.info(`Loaded job module: ${file}`);
    } else {
      logger.warn(`Job module missing register(): ${file}`);
    }
  }
  return mods;
}

function register(job) {
  registered.push(job);
}

async function startAll(client) {
  const mods = loadJobs();
  // allow modules to register jobs into memory
  for (const m of mods) await m.register({ register, client });

  // start all jobs and collect stop fns
  for (const job of registered) {
    try {
      const stop = await job.start(client);
      if (typeof stop === 'function') stopFns.push(stop);
      logger.info(`Started job: ${job.name || 'unnamed'}`);
    } catch (e) {
      logger.error(`Failed to start job ${job.name || 'unnamed'}:`, e);
    }
  }
}

async function stopAll() {
  for (const stop of stopFns) {
    try { await stop(); } catch (e) { logger.error('Error stopping job:', e); }
  }
  stopFns = [];
  registered = [];
}

function createIntervalJob({ name, intervalMs, run }) {
  return {
    name,
    async start(client) {
      let timer = setInterval(() => run(client).catch(err => logger.error(`${name} run error:`, err)), intervalMs);
      // kick off immediately once
      run(client).catch(err => logger.error(`${name} initial run error:`, err));
      return async () => clearInterval(timer);
    }
  };
}

module.exports = { register, startAll, stopAll, createIntervalJob };
