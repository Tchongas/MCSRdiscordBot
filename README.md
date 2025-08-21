# MCSRdiscordBot

A minimal discord.js bot scaffold with a sample `/ping` slash command.

## Prerequisites
- Node.js 18+ recommended
- A Discord application and bot token: https://discord.com/developers/applications

## Setup
1. Copy `.env.example` to `.env` and fill in values:
   - `TOKEN` (bot token)
   - `CLIENT_ID` (application ID)
   - `GUILD_ID` (a test server ID)

2. Install dependencies:
```bash
npm install discord.js dotenv
npm install -D nodemon
```

3. Register slash commands to your test guild:
```bash
npm run register
```

4. Start the bot:
```bash
npm run dev   # auto-restarts with nodemon
# or
npm start     # plain node
```

## Files
- `src/index.js` — bot entrypoint. Logs in and handles `/ping`.
- `src/register-commands.js` — registers slash commands to a guild.
- `.env.example` — environment variable template.
- `package.json` — scripts: `start`, `dev`, `register`.

## Notes
- Commands registered to a guild appear instantly. For global commands use `Routes.applicationCommands(CLIENT_ID)` but allow up to 1 hour to propagate.

## Modular architecture

Project structure:

```
src/
  commands/            # One file per slash command
    ping.js
    user.js
    server.js
    say.js
  events/              # Discord.js event handlers
    ready.js
    interactionCreate.js
  lib/
    loader.js          # Dynamic loaders for commands/events
    logger.js          # Simple timestamped logger
  index.js             # Bootstraps client, loads commands/events
  register-commands.js # Registers slash commands to a guild
```

### Add a new command
Create `src/commands/echo.js`:

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Echo your input')
    .addStringOption(o => o.setName('text').setDescription('Text to echo').setRequired(true)),
  async execute(interaction) {
    await interaction.reply({ content: interaction.options.getString('text', true), ephemeral: true });
  },
};
```

Then register and run:

```bash
npm run register
npm run dev
```

### Add an event
Create `src/events/messageCreate.js`:

```js
const { Events } = require('discord.js');
module.exports = {
  name: Events.MessageCreate,
  async execute(client, message) {
    // your logic
  },
};
```

### DX tips
- Use `npm run dev` (nodemon) for auto-restart on file changes.
- Commands/events are auto-loaded from their folders. Each command exports `{ data, execute }`.
- Errors are logged with timestamps via `src/lib/logger.js`.
