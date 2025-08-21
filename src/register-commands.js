require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { getCommandData } = require('./lib/loader');

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Missing env vars. Ensure TOKEN, CLIENT_ID, and GUILD_ID are set in .env');
  process.exit(1);
}

// Load all commands from src/commands
const commands = getCommandData();

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🔄 Refreshing application (guild) commands...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Successfully reloaded application (guild) commands.');
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
})();
