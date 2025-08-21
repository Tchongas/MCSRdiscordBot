require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { loadCommands, loadEvents } = require('./lib/loader');
const logger = require('./lib/logger');

const { TOKEN } = process.env;

if (!TOKEN) {
  logger.error('Missing TOKEN in environment. Create a .env file based on .env.example');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Load commands into client and bind events
loadCommands(client);
loadEvents(client);

client.login(TOKEN);
