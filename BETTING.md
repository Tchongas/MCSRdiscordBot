# MCSR Fantasy Betting — How It Works

A concise, complete guide to the fake-currency betting system: storage, commands, jobs, and setup.

## What’s Included

- `src/commands/mcsrbet.js` — Slash command with subcommands
- `src/jobs/betsWatcher.js` — Background job to refresh events and settle bets
- `src/lib/betting.js` — Betting logic (events, place bets, settlement)
- `src/lib/economy.js` — User balance and leaderboard
- `src/lib/store.js` — Simple JSON persistence under `src/data/`

## Prerequisites

- Node.js 18+
- Discord bot token, application ID, and a test guild ID
- Google App APIs that return betting events and results

## Configure .env

Add the following (example values shown):

```
TOKEN=your-bot-token
CLIENT_ID=your-app-id
GUILD_ID=your-guild-id

# Google App APIs for betting
GOOGLE_BETS_API_URL=https://your-google-app.example.com/events
GOOGLE_RESULTS_API_URL=https://your-google-app.example.com/results

# Polling interval (ms) for the watcher
BETS_POLL_MS=30000

# Starting balance (coins) for new users
STARTING_BALANCE=1000
```

## Register Commands and Run

1) Register slash commands so `/mcsrbet` appears in your guild:
```
npm run register
```

2) Start the bot:
```
npm run dev   # with nodemon
# or
npm start     # plain node
```

When the bot is ready, background jobs auto-start via `src/events/ready.js` + `src/lib/jobs.js`.

## Using /mcsrbet

- `/mcsrbet balance`
  - Shows your current balance.

- `/mcsrbet events`
  - Lists currently open betting events (from cached Google Bets API data).
  - Auto-refreshes cache if empty.

- `/mcsrbet bet event:<ID> option:<Exact Option> amount:<Coins>`
  - Places a bet, immediately deducting your balance.
  - `option` must match exactly one of the event’s options.
  - Fails if betting is closed (`closesAt` is in the past) or balance is insufficient.

- `/mcsrbet mybets`
  - Shows your active (unsettled) bets.

- `/mcsrbet leaderboard`
  - Displays the top balances across users.

- `/mcsrbet refresh` (Admins only — Manage Guild)
  - Refreshes the events cache from Google Bets API on demand.

## Google API Contracts

The system tolerates either a plain array or an object with `items: []`.

- Bets API (`GOOGLE_BETS_API_URL`) — events
  - Expected fields per event:
    - `id` (string)
    - `title` (string)
    - `options` (string[])
    - `closesAt` (ISO timestamp, optional)

- Results API (`GOOGLE_RESULTS_API_URL`) — results
  - Expected fields per result:
    - `eventId` (string)
    - `winner` (string, must match an event option)
    - `settled` (boolean)

If your fields differ, adjust normalizers in:
- `src/lib/betting.js` (refreshEvents)
- `src/jobs/betsWatcher.js` (results parsing)

## How Settlement Works

- Watcher (`src/jobs/betsWatcher.js`) fetches results periodically.
- For each result with `settled: true`, bets for that `eventId` are settled by `winner`.
- Payout formula per winning bet:
  - `payout = stake + proportional_share`
  - `proportional_share = (bet.stake / total_on_winner) * total_on_losers`
  - Losers receive `0`.
- Winners’ payouts are credited to user balances via `src/lib/economy.js`.
- Bets are marked settled and stored in `src/data/bets.json`.

## Data Storage

All persistence is JSON files under `src/data/` (auto-created):

- `economy.json` — `{ [userId]: { balance, won, lost } }`
- `bets.json` — `[{ id, userId, eventId, option, amount, settled, payout?, settledAt? }]`
- `events.json` — `{ updatedAt, items: [ { id, title, options, closesAt? } ] }`

Managed by `src/lib/store.js` with best-effort atomic writes.

## Admin Tips

- Change initial funds with `STARTING_BALANCE` in `.env`.
- Add moderation tools (grant/reset) by extending `src/commands/mcsrbet.js`.
- If you want announcement messages on settlement, we can add a channel notifier job.

## Troubleshooting

- Command not visible: re-run `npm run register` and verify `TOKEN/CLIENT_ID/GUILD_ID`.
- No open events: ensure `GOOGLE_BETS_API_URL` returns events and options; check `closesAt`.
- Bets not settling: verify `GOOGLE_RESULTS_API_URL` returns `{ eventId, winner, settled: true }` and that the bot is running long enough to poll.
- Data not saving: verify the process has permission to write under `src/data/`.
