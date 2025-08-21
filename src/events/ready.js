const { Events } = require('discord.js');
const logger = require('../lib/logger');
const { startAll } = require('../lib/jobs');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(`Logged in as ${client.user.tag}`);
    // Start background jobs (e.g., API watchers)
    startAll(client).catch(err => logger.error('Failed to start jobs:', err));
  },
};
