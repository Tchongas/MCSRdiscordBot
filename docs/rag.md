# RAG System Documentation

Simple file-based retrieval for the DarkGPT message handler.

## How it works

When a user sends a `darkgpt` message, the bot builds extra context from local markdown files and appends it to the system prompt sent to OpenRouter.

Context is retrieved in three ways and then **ranked**:

1. **Sender context** — blocks that mention the user's display name/username.
2. **Keyword context** — files triggered by the `keywords.json` dictionary.
3. **Word overlap** — meaningful words shared between the prompt and a block.

Blocks are scored, sorted by relevance, and included until `DARKGPT_RAG_MAX_CHARS` is reached.

| Signal | Score |
|---|---|
| Matched a keyword-file trigger | `+20` |
| Block mentions sender name | `+10` |
| Shared meaningful word | `+1` per word |

The result is appended to the system prompt under `Relevant context from project files:`.

## Live API cache context

The bot also pulls live data from its internal caches (`src/lib/profile.js`) when a runner name is detected in the prompt or when the sender is a known runner:

- **Earnings** from `earningsCache`
- **RSG PB** from `rsgRunsCache`
- **Ranked PB / Elo** from the MCSR Ranked API (cached with `RANKED_CACHE_TTL_MS`)

Live sections are formatted like:

```
[live:pato]
Nome: Pato
Estado: BR
Ganhos: R$ 1.234
RSG PB: 10:28 (Housing) — vamo querer
Ranked PB: 7:49
Ranked Elo: 2200
```

Live sections are prepended before file-based RAG context and count toward `DARKGPT_RAG_MAX_CHARS`.

## Folder structure

```
src/data/rag/
├── sanjinhu.md        # blocks about a person
├── tutoriais.md       # blocks about tutorials
├── fatos.md           # fixed facts about the bot
├── keywords.json      # keyword → file mapping
├── pessoas/           # one small file per person/topic
│   ├── index.md       # broad friends list
│   ├── epik.md
│   ├── bocao.md
│   └── ...
└── strats/            # one small file per strategy/term
    ├── index.md       # broad overview list
    ├── boateye.md
    ├── bastion.md
    ├── zero_cycle.md
    └── ...
```

## Data file format

Each `.md` file contains blocks separated by a line with three or more dashes:

```md
---
sanjinhu é um speedrunner BR de MCSR.
Teve WR da ranked no passado com um tempo de 06:04.
---

---
Curiosidade: sanjinhu aparece na tabela de RSG BR com 08:44 no Bridge.
---
```

When the sender's name appears anywhere inside a block, the **entire block** is included as context.

## Keyword dictionary

`src/data/rag/keywords.json` maps keywords to files. If the user's question contains a keyword, every block in the matched file gets a `+20` score bonus, which usually pushes those blocks to the top of the context.

```json
{
  "tutorial, tutoriais, guia, guias, video, videos, como faz, como fazer": "tutoriais.md",
  "boateye": "strats/boateye.md"
}
```

- Keywords are case-insensitive.
- Multiple keywords for the same file can be written in one key separated by commas (`,`), pipes (`|`) or dots (`.`).
- The value can be a single filename or an array of filenames.
- Filenames are relative to `src/data/rag/` by default; subfolders like `strats/boateye.md` work.
- **Sender-only keys**: a key prefixed with `sender:` (e.g., `"sender:darkk575"`) only matches the message sender's **Discord @ username**, not their display name or a name mentioned inside the prompt. This prevents users from spoofing identity by changing their server nickname.

## Configuration

| Environment variable | Description | Default |
|---|---|---|
| `DARKGPT_RAG_FILES` | Comma-separated glob patterns for RAG data files | `src/data/rag/**/*.md` |
| `DARKGPT_RAG_MAX_CHARS` | Max characters of context appended to the prompt | `2000` |
| `DARKGPT_RAG_MAX_BLOCKS` | Max number of context blocks returned | `3` |
| `DARKGPT_RAG_KEYWORDS_FILE` | Path to the keyword dictionary JSON | `src/data/rag/keywords.json` |
| `RANKED_CACHE_TTL_MS` | How long ranked stats are cached per player (live context) | `300000` (5 min) |

## Adding new data

1. Create a `.md` file under `src/data/rag/` (or a subfolder like `src/data/rag/strats/`).
2. Write one or more blocks separated by `---`.
3. If the file should be triggered by keywords, add entries to `keywords.json` using the relative path (e.g. `"boateye": "strats/boateye.md"`).

No restart is needed — files are read on every `darkgpt` message.

## Examples

### Person context

User `sanjinhu` asks anything:

- Blocks in `src/data/rag/sanjinhu.md` mentioning `sanjinhu` get `+10` and rank highly.

### Tutorial context

User asks `darkgpt como faz boateye?`:

- Keyword `como faz` gives every block in `tutoriais.md` a `+20` bonus.
- The `boateye` block also shares the word `boateye` with the prompt, so it ranks first.
- Other tutorial blocks are included if they fit within `DARKGPT_RAG_MAX_CHARS`.

### No explicit keyword

User asks `darkgpt me explica boateye`:

- No keyword-file match, but the word `boateye` overlaps with the tutorial block.
- The `boateye` tutorial block is still returned because it shares a meaningful word.

### Sender-only keyword

`keywords.json` contains `"sender:darkk575": "dark.md"` (using the Discord @ username, not the display name):

- User `@darkk575` asks anything → `dark.md` blocks are included.
- A user with nickname "dark" asks anything → `dark.md` is **not** included.
- Another user asks "fale do dark" → `dark.md` is **not** included (the name was only mentioned, not the sender).
