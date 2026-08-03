# Event Sign-up System

This bot supports server events where users sign up through a button + modal flow.

## Quick start

1. Create an event config:

```txt
/eventconfig criar nome:torneio_verao titulo:"🏆 Torneio de Verão" descricao:"Inscreva-se no torneio!" cor:#00b894 imagem:https://i.imgur.com/example.png
```

2. Add sign-up fields:

```txt
/eventconfig campo adicionar nome:torneio_verao id:minecraft label:"Minecraft username" style:short obrigatorio:true maxlength:32
/eventconfig campo adicionar nome:torneio_verao id:duo label:"Nome do duo" style:short obrigatorio:true maxlength:32
/eventconfig campo adicionar nome:torneio_verao id:experiencia label:"Experiência com PvP" style:paragraph obrigatorio:false maxlength:500
```

3. Post the event (type a few letters and Discord will autocomplete existing events):

```txt
/evento nome:torneio_verao
```

4. Users click **INSCREVA-SE**, fill the modal, and are saved.

## Commands

### `/eventconfig`

Admin-only.

| Subcommand | Purpose |
|------------|---------|
| `criar` | Creates a new event config. |
| `editar` | Edits title, description, color, image, or link button. |
| `info` | Shows current config and fields. |
| `deletar` | Removes the event and all signups. |
| `campo adicionar` | Adds a question/field to the sign-up modal. |
| `campo remover` | Removes a field. |
| `campo editar` | Edits an existing field. |

All `nome` options support autocomplete — start typing and pick from existing events.

### `/evento`

Posts the event embed. Only admins and the hardcoded allowed user can use it.

### `/eventolimpar`

Deletes every posted embed for an event and stops tracking their message IDs. Same permissions as `/evento`.

## Adding or changing an image

The event embed supports one big image via the `imagem` option.

**When creating the event:**

```txt
/eventconfig criar nome:torneio_verao titulo:"🏆 Torneio de Verão" descricao:"..." imagem:https://i.imgur.com/example.png
```

**After creation:**

```txt
/eventconfig editar nome:torneio_verao imagem:https://i.imgur.com/newimage.png
```

**To remove the image:**

```txt
/eventconfig editar nome:torneio_verao imagem:remover
```

Rules:

- The value must be a direct image URL (Discord will render it).
- The bot does **not** upload files — it only accepts URLs.
- Any tracked posted messages are updated automatically when you edit the image.

## Adding a link button

You can add an optional blue link button next to **INSCREVA-SE**.

```txt
/eventconfig editar nome:torneio_verao link_label:"Regras do torneio" link_url:https://example.com/regras
```

Remove it later with:

```txt
/eventconfig editar nome:torneio_verao link_label:remover
```

The link button is a standard Discord URL button — it opens the URL when clicked.

## Button notes

- Buttons live in the same action row and share the row width equally.
- The event embed no longer has a timestamp footer.

## Field configuration

Each field in the modal has these properties:

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `id` | Yes | string | Internal ID. Use only lowercase letters, numbers, and underscores. |
| `label` | Yes | string | Text shown above the input in the modal. |
| `style` | No | `short` or `paragraph` | Single-line or multi-line. Default: `short`. |
| `required` | No | boolean | Whether the user must fill it. Default: `true`. |
| `maxLength` | No | number | Max characters. Default: `4000`. |

### Example `config.json`

Stored at `data/events/<slug>/config.json`:

```json
{
  "title": "🏆 Torneio de Verão",
  "description": "Inscreva-se no torneio de PvP do servidor!",
  "color": "#00b894",
  "image": "https://i.imgur.com/example.png",
  "modalTitle": "Inscrição: 🏆 Torneio de Verão",
  "fields": [
    {
      "id": "minecraft",
      "label": "Minecraft username",
      "style": "short",
      "required": true,
      "maxLength": 32
    },
    {
      "id": "experiencia",
      "label": "Experiência com PvP",
      "style": "paragraph",
      "required": false,
      "maxLength": 500
    }
  ]
}
```

## What the sign-up flow looks like

1. Admin posts the event embed with `/evento`.
2. The bot stores the message ID for live updates.
3. User clicks **INSCREVA-SE**.
4. A modal opens with all configured fields.
5. User submits. The bot saves the answers to `data/events/<slug>/signups.json`.
6. The bot sends a private confirmation message.
7. If the admin edits the event (`/eventconfig editar` or `/eventconfig campo ...`), all tracked posted messages are updated automatically.

## Important limitations

### Modals only support text input

A Discord modal can only contain **TextInput** components. That means:

- ✅ Short single-line text
- ✅ Paragraph multi-line text
- ❌ Dropdown / select menus (single or multi-select)
- ❌ Buttons (besides the submit button)
- ❌ Images, embeds, or attachments inside the modal
- ❌ File uploads

If you need dropdowns with 3+ selections or file uploads, those must be handled as **message components** below the embed, not inside the modal. That is a different interaction pattern and is not implemented in this system.

### Modal limits

- Maximum **5 text fields** per modal.
- Each field label can be up to 45 characters.
- Each input can be up to 4,000 characters (configurable via `maxLength`).

### Posted message sync

Editing the config updates all tracked posted messages. If a message was deleted or the bot lost permission to it, that entry is removed from tracking and won't sync again. To "resync" after losing a message, just post the event again with `/evento`.

## File locations

| File | Purpose |
|------|---------|
| `data/events/<slug>/config.json` | Event settings and modal fields. |
| `data/events/<slug>/signups.json` | Stored user signups. |
| `data/events/<slug>/messages.json` | Tracked Discord message IDs for live updates. |

## Notes

- The event slug is generated from the `nome` option: lowercased, accents removed, spaces/special chars become hyphens, max 40 characters.
- The public embed does **not** show the participant list. Only admins can read the signup data from the JSON file.
