# Project Documentation

A maintainable, modular Discord bot built with discord.js v14.

- Node: 18+
- Entrypoint: `src/index.js`
- Commands directory: `src/commands/`
- Events directory: `src/events/`
- Utilities: `src/lib/`

## Environment variables
Create `.env` (based on `.env.example`):

- `TOKEN`: Bot token
- `CLIENT_ID`: Application (client) ID
- `GUILD_ID`: Guild ID for fast command registration (dev/test)

## NPM scripts
- `npm run dev` — Start with nodemon
- `npm start` — Start with node
- `npm run register` — Register slash commands to the guild (`GUILD_ID`)

---

## Architecture overview

- `src/index.js`
  - Creates the `Client`
  - Calls `loadCommands(client)` and `loadEvents(client)`
  - Logs in using `TOKEN`
- `src/lib/loader.js`
  - `loadCommands(client)` reads `src/commands/`, validates and attaches commands to `client.commands`
  - `loadEvents(client)` reads `src/events/` and binds handlers
  - `getCommandData()` returns JSON data for slash command registration
- `src/lib/logger.js` — Simple timestamped logger used across files
- `src/register-commands.js` — Loads command data and publishes commands to a guild

Directory layout:

```
src/
  commands/
    ping.js
    user.js
    server.js
    say.js
  events/
    ready.js
    interactionCreate.js
  lib/
    loader.js
    logger.js
  index.js
  register-commands.js
```

---

## Commands: module API
Each command is a single module exporting:

- `data`: an instance of `SlashCommandBuilder`
- `execute(interaction)`: async function invoked when the command runs

Example: `src/commands/ping.js`
```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong! and latency'),
  async execute(interaction) {
    const t = Date.now();
    await interaction.reply({ content: 'Pinging...', ephemeral: true });
    await interaction.editReply(`Pong! ${Date.now() - t}ms`);
  },
};
```

### Options
Use `SlashCommandBuilder#addStringOption`, `addIntegerOption`, etc.

Example with options and ephemeral toggle (`src/commands/say.js`):
```js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something')
    .addStringOption(o => o.setName('text').setDescription('Text').setRequired(true))
    .addBooleanOption(o => o.setName('ephemeral').setDescription('Only you can see it?'))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
  async execute(interaction) {
    const text = interaction.options.getString('text', true);
    const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;
    await interaction.reply({ content: text, ephemeral });
  },
};
```

### Permissions
- Set default required member permissions on the command via `.setDefaultMemberPermissions(PermissionFlagsBits.XXX)`.
- For advanced checks, validate inside `execute()` and return an error message if not allowed.

### Error handling
Handlers should `try/catch` errors. Central error handling exists in `src/events/interactionCreate.js`:
```js
// interactionCreate.js (excerpt)
try {
  await command.execute(interaction);
} catch (error) {
  logger.error('Error executing command:', error);
  if (interaction.isRepliable()) {
    const reply = { content: 'There was an error while executing this command!', ephemeral: true };
    interaction.replied || interaction.deferred ? await interaction.followUp(reply) : await interaction.reply(reply);
  }
}
```

### Adding a new command
1. Create a new file in `src/commands/`, export `{ data, execute }`.
2. Run `npm run register` to publish the slash command.
3. Start the bot and test: `npm run dev`.

---

## Events: module API
Event modules export:

- `name`: one of `Events.*`
- `once?`: optional boolean to run only once
- `execute(client, ...args)`: async handler

Example: `src/events/ready.js`
```js
const { Events } = require('discord.js');
const logger = require('../lib/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(`Logged in as ${client.user.tag}`);
  },
};
```

Example: `src/events/interactionCreate.js`
```js
const { Events } = require('discord.js');
const logger = require('../lib/logger');

module.exports = {
  name: Events.InteractionCreate,
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return logger.warn(`No handler for ${interaction.commandName}`);
    // execution and error handling...
  },
};
```

### Adding a new event
1. Create `src/events/<eventName>.js` with `{ name, once?, execute }`.
2. Restart dev server (nodemon auto-restarts).

---

## Loader utilities (`src/lib/loader.js`)

- `loadCommands(client): string[]`
  - Reads all `src/commands/*.js`
  - Validates a module exports `{ data, execute }`
  - Attaches to `client.commands` and returns an array of command JSON data (useful for debugging)

- `getCommandData(): object[]`
  - Reads commands and returns the JSON payload used by Discord REST to register commands

- `loadEvents(client): void`
  - Reads all `src/events/*.js` and binds them using `client.on` or `client.once`

All loaders clear `require.cache` enabling quick iteration with nodemon.

---

## Registering slash commands
`src/register-commands.js` uses `getCommandData()` and Discord REST to upsert guild commands:

```js
const { REST, Routes } = require('discord.js');
const { getCommandData } = require('./lib/loader');

const commands = getCommandData();
await rest.put(
  Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
  { body: commands }
);
```

- Guild commands update instantly.
- For production, consider `Routes.applicationCommands(CLIENT_ID)` (global) and allow up to 1 hour to propagate.

---

## Common tasks and examples

- Add a command with subcommands:
```js
const { SlashCommandBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('manage')
    .setDescription('Management')
    .addSubcommand(s => s.setName('add').setDescription('Add').addStringOption(o => o.setName('name').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove').addStringOption(o => o.setName('name').setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') { /* ... */ }
    if (sub === 'remove') { /* ... */ }
    await interaction.reply({ content: `Handled ${sub}`, ephemeral: true });
  }
};
```

- Defer replies for long tasks:
```js
await interaction.deferReply({ ephemeral: true });
// long work...
await interaction.editReply('Done!');
```

- Restrict to a role (basic check inside execute):
```js
const roleId = '123';
if (!interaction.member.roles.cache.has(roleId)) {
  return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
}
```

---

## Troubleshooting
- 403 `Missing Access` on registration
  - Ensure the bot is invited to the target guild with `applications.commands` scope
  - Ensure `CLIENT_ID` and `GUILD_ID` are correct
- Commands not appearing
  - Guild scope is instant; global scope can take up to 1 hour
  - Make sure you ran `npm run register` after adding a new command
- `Missing TOKEN`
  - Create `.env` with `TOKEN`

---

## Conventions and best practices
- One command per file, named after the command.
- Keep handlers small; delegate logic to helper modules in `src/lib/` for complex features.
- Use ephemeral responses for noisy commands.
- Validate inputs; provide friendly error messages.
- Log meaningful events via `logger` and prefer structured messages.

---

## Background jobs (API watchers, schedulers)

Jobs run in the background alongside the bot to integrate with external APIs and emit messages into Discord.

Files:
- `src/lib/jobs.js` — tiny job runner with helpers:
  - `register(job)` — register a job object
  - `startAll(client)` / `stopAll()` — lifecycle
  - `createIntervalJob({ name, intervalMs, run })` — convenience to run `run(client)` on an interval
- `src/jobs/apiWatcher.js` — example job that polls an API and posts on change
- `src/events/ready.js` — calls `startAll(client)` when the bot is ready

Environment in `.env`:
```
API_WATCH_URL=               # the endpoint to poll
API_POLL_MS=60000            # optional interval (ms)
ANNOUNCE_CHANNEL_ID=         # target text channel ID (e.g., #test)
```

How it works:
- Uses `ETag`/`Last-Modified` when provided for efficient polling (sends `If-None-Match` / `If-Modified-Since`).
- Falls back to hashing the response body to detect changes.
- Sends a JSON-formatted preview (truncated) to `ANNOUNCE_CHANNEL_ID` when a change is detected.

### Ranked matches watcher (`src/jobs/rankedMatchesWatcher.js`)
- Polls a ranked matches API returning an array of recent matches.
- Filters for new matches where one or both players are Brazilian (`country` is `br`).
- Avoids duplicates within the current process by keeping the last 50 posted match IDs in memory.
- Posts a modern embed with winner/loser, seed info, category, mode, and duration to a target channel.

Environment in `.env`:
```
RANKED_API_URL=                    # endpoint that returns recent matches (array)
RANKED_POLL_MS=60000               # optional interval (ms)
RANKED_ANNOUNCE_CHANNEL_ID=        # target text channel ID for ranked updates
```

Notes:
- Country detection treats `br` (case-insensitive) as Brazil.
- Only last 50 posted IDs are remembered per process; restarting the bot forgets history.

Create your own job:
1. Add `src/jobs/myJob.js`:
```js
const { createIntervalJob } = require('../lib/jobs');
module.exports = {
  async register({ register }) {
    register(createIntervalJob({
      name: 'myJob',
      intervalMs: 30000,
      async run(client) {
        // fetch/process and optionally send messages using client
      },
    }));
  }
};
```
2. Ensure any needed env vars are in `.env` (and document in `.env.example`).
3. Restart the bot. `ready` will start the job automatically.

Best practices:
- Keep job code idempotent and handle network errors gracefully.
- Use validators (ETag/Last-Modified) when available to reduce bandwidth.
- Consider exponential backoff after repeated failures.
- For persistent state across restarts, store signatures in a file/DB instead of memory.
