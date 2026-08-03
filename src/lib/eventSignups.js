const fs = require('fs');
const path = require('path');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');
const logger = require('./logger');

const EVENTS_DIR = path.resolve(__dirname, '../../data/events');

function ensureEventDir(slug) {
  const dir = path.join(EVENTS_DIR, slug);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function eventSlug(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'event';
}

function eventConfigPath(slug) {
  return path.join(EVENTS_DIR, slug, 'config.json');
}

function eventSignupsPath(slug) {
  return path.join(EVENTS_DIR, slug, 'signups.json');
}

function loadEventConfig(slug) {
  const filePath = eventConfigPath(slug);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(raw);
    if (!config || !Array.isArray(config.fields) || config.fields.length === 0) return null;
    return config;
  } catch (e) {
    logger.error(`Failed to load event config for ${slug}:`, e);
    return null;
  }
}

function saveEventConfig(slug, config) {
  ensureEventDir(slug);
  try {
    fs.writeFileSync(eventConfigPath(slug), JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (e) {
    logger.error(`Failed to save event config for ${slug}:`, e);
    return false;
  }
}

function deleteEventConfig(slug) {
  try {
    const configPath = eventConfigPath(slug);
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    const signupsPath = eventSignupsPath(slug);
    if (fs.existsSync(signupsPath)) fs.unlinkSync(signupsPath);
    return true;
  } catch (e) {
    logger.error(`Failed to delete event ${slug}:`, e);
    return false;
  }
}

function readSignups(slug) {
  ensureEventDir(slug);
  const filePath = eventSignupsPath(slug);
  if (!fs.existsSync(filePath)) return { signups: {} };
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!data || typeof data.signups !== 'object') return { signups: {} };
    return data;
  } catch (e) {
    logger.error(`Failed to read signups for ${slug}:`, e);
    return { signups: {} };
  }
}

function writeSignups(slug, data) {
  ensureEventDir(slug);
  try {
    fs.writeFileSync(eventSignupsPath(slug), JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    logger.error(`Failed to write signups for ${slug}:`, e);
  }
}

function hasSignup(slug, userId) {
  return userId in readSignups(slug).signups;
}

function getSignup(slug, userId) {
  return readSignups(slug).signups[userId] || null;
}

function addOrUpdateSignup(slug, userId, displayName, values) {
  const data = readSignups(slug);
  data.signups[userId] = {
    displayName,
    values: values || {},
    updatedAt: new Date().toISOString(),
  };
  writeSignups(slug, data);
}

function removeSignup(slug, userId) {
  const data = readSignups(slug);
  delete data.signups[userId];
  writeSignups(slug, data);
}

function getSignupList(slug) {
  return Object.entries(readSignups(slug).signups).map(([userId, s]) => ({ userId, ...s }));
}

function parseColor(value, fallback = 0x00b894) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const hex = value.replace('#', '');
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return parseInt(hex, 16);
  }
  return fallback;
}

function formatSignupLine(signup, config) {
  const parts = config.fields
    .map(f => {
      const value = (signup.values[f.id] || '').trim();
      if (!value) return null;
      return `**${f.label}:** ${value}`;
    })
    .filter(Boolean);
  const line = parts.length ? parts.join(' | ') : 'Inscrição sem dados.';
  return `<@${signup.userId}> — ${line}`;
}

function buildEventEmbed(slug, config) {
  const embed = new EmbedBuilder()
    .setTitle(config.title || '🎉 Inscrição para o evento')
    .setDescription(config.description || 'Clique no botão abaixo para se inscrever!')
    .setColor(parseColor(config.color))
    .setTimestamp();

  if (config.image) {
    embed.setImage(config.image);
  }

  return embed;
}

function buildButtonRow(slug) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`event:${slug}:signup`)
        .setLabel('INSCREVA-SE')
        .setStyle(ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`event:${slug}:cancel`)
        .setLabel('Cancelar inscrição')
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

function inputStyle(style) {
  if (String(style).toLowerCase() === 'paragraph') return TextInputStyle.Paragraph;
  return TextInputStyle.Short;
}

function buildSignupModal(slug, config, existing = null) {
  const modal = new ModalBuilder()
    .setCustomId(`event:${slug}:modal`)
    .setTitle(config.modalTitle || 'Inscrição no evento');

  for (const field of config.fields) {
    const input = new TextInputBuilder()
      .setCustomId(`event:${slug}:field:${field.id}`)
      .setLabel(field.label)
      .setStyle(inputStyle(field.style))
      .setRequired(field.required !== false)
      .setMaxLength(field.maxLength || 4000);

    if (existing?.values?.[field.id]) {
      input.setValue(String(existing.values[field.id]).slice(0, field.maxLength || 4000));
    }

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

function parseEventCustomId(customId) {
  if (!customId || !customId.startsWith('event:')) return null;
  const parts = customId.split(':');
  if (parts.length < 3) return null;
  const slug = parts[1];
  const action = parts[2];
  return { slug, action, fieldId: parts[3] === 'field' ? parts[4] : undefined };
}

async function handleSignupButton(interaction, slug) {
  const config = loadEventConfig(slug);
  if (!config) {
    return interaction.reply({ content: 'Configuração do evento não encontrada.', flags: MessageFlags.Ephemeral });
  }
  const existing = getSignup(slug, interaction.user.id);
  const modal = buildSignupModal(slug, config, existing);
  await interaction.showModal(modal);
}

async function handleCancelButton(interaction, slug) {
  if (!hasSignup(slug, interaction.user.id)) {
    return interaction.reply({ content: 'Você ainda não está inscrito.', flags: MessageFlags.Ephemeral });
  }
  removeSignup(slug, interaction.user.id);
  const config = loadEventConfig(slug);
  if (!config) {
    return interaction.update({ content: 'Inscrição cancelada, mas a configuração do evento não foi encontrada.', components: [] });
  }
  await interaction.update({ embeds: [buildEventEmbed(slug, config)], components: buildButtonRow(slug) });
  await interaction.followUp({ content: '✅ Inscrição cancelada.', flags: MessageFlags.Ephemeral });
}

async function handleModalSubmit(interaction, slug) {
  const config = loadEventConfig(slug);
  if (!config) {
    return interaction.reply({ content: 'Configuração do evento não encontrada.', flags: MessageFlags.Ephemeral });
  }

  const values = {};
  for (const field of config.fields) {
    const inputId = `event:${slug}:field:${field.id}`;
    values[field.id] = interaction.fields.getTextInputValue(inputId)?.trim() || '';
  }

  const displayName = interaction.member?.displayName || interaction.user.username;
  addOrUpdateSignup(slug, interaction.user.id, displayName, values);

  if (interaction.message) {
    await interaction.update({ embeds: [buildEventEmbed(slug, config)], components: buildButtonRow(slug) });
    await interaction.followUp({ content: '✅ Inscrição confirmada! Você pode clicar em "Cancelar inscrição" para desfazer.', flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ content: '✅ Inscrição salva!', flags: MessageFlags.Ephemeral });
  }
}

module.exports = {
  eventSlug,
  loadEventConfig,
  saveEventConfig,
  deleteEventConfig,
  buildEventEmbed,
  buildButtonRow,
  buildSignupModal,
  parseEventCustomId,
  handleSignupButton,
  handleCancelButton,
  handleModalSubmit,
};
