const fs = require('fs');
const path = require('path');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextDisplayBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  MentionableSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');
const logger = require('./logger');
const { scheduleSignupSync, scheduleSignupRemoval } = require('./externalSignupSync');

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
    if (!config || !Array.isArray(config.fields)) return null;
    return config;
  } catch (e) {
    logger.error(`Failed to load event config for ${slug}:`, e);
    return null;
  }
}

function isEventPostable(config) {
  return config && Array.isArray(config.fields) && config.fields.length > 0;
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
    const messagesPath = eventMessagesPath(slug);
    if (fs.existsSync(messagesPath)) fs.unlinkSync(messagesPath);
    return true;
  } catch (e) {
    logger.error(`Failed to delete event ${slug}:`, e);
    return false;
  }
}

function eventMessagesPath(slug) {
  return path.join(EVENTS_DIR, slug, 'messages.json');
}

function readTrackedMessages(slug) {
  ensureEventDir(slug);
  const filePath = eventMessagesPath(slug);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(m => m && m.messageId && m.channelId);
  } catch (e) {
    logger.error(`Failed to read tracked messages for ${slug}:`, e);
    return [];
  }
}

function clearTrackedMessages(slug) {
  ensureEventDir(slug);
  try {
    const filePath = eventMessagesPath(slug);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    logger.error(`Failed to clear tracked messages for ${slug}:`, e);
  }
}

function writeTrackedMessages(slug, messages) {
  ensureEventDir(slug);
  try {
    fs.writeFileSync(eventMessagesPath(slug), JSON.stringify(messages, null, 2), 'utf-8');
  } catch (e) {
    logger.error(`Failed to write tracked messages for ${slug}:`, e);
  }
}

function trackEventMessage(slug, message) {
  if (!message?.id || !message?.channelId) return;
  const list = readTrackedMessages(slug);
  if (list.some(m => m.messageId === message.id)) return;
  list.push({
    messageId: message.id,
    channelId: message.channelId,
    guildId: message.guildId || null,
    postedAt: new Date().toISOString(),
  });
  writeTrackedMessages(slug, list);
}

async function updatePostedMessages(client, slug, config) {
  const messages = readTrackedMessages(slug);
  if (messages.length === 0) return 0;

  const embed = buildEventEmbed(slug, config);
  const components = buildButtonRow(slug, config);
  const updated = [];

  for (const item of messages) {
    try {
      const channel = await client.channels.fetch(item.channelId);
      if (!channel) throw new Error('Channel not found');
      const msg = await channel.messages.fetch(item.messageId);
      if (!msg) throw new Error('Message not found');
      await msg.edit({ embeds: [embed], components });
      updated.push(item.messageId);
    } catch (e) {
      logger.warn(`Failed to update tracked event message ${item.messageId}: ${e.message}`);
    }
  }

  const cleaned = messages.filter(m => updated.includes(m.messageId));
  if (cleaned.length !== messages.length) {
    writeTrackedMessages(slug, cleaned);
  }
  return updated.length;
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
  scheduleSignupSync(slug, userId, displayName, values);
}

function removeSignup(slug, userId, displayName = '') {
  const data = readSignups(slug);
  const existing = data.signups[userId];
  delete data.signups[userId];
  writeSignups(slug, data);
  scheduleSignupRemoval(slug, userId, displayName || existing?.displayName || '');
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
    .setColor(parseColor(config.color));

  if (config.image) {
    embed.setImage(config.image);
  }

  return embed;
}

function listEventSlugs() {
  if (!fs.existsSync(EVENTS_DIR)) return [];
  try {
    return fs.readdirSync(EVENTS_DIR)
      .filter(name => fs.statSync(path.join(EVENTS_DIR, name)).isDirectory())
      .sort();
  } catch (e) {
    logger.error('Failed to list event slugs:', e);
    return [];
  }
}

function buildButtonRow(slug, config = null) {
  const buttons = [
    new ButtonBuilder()
      .setCustomId(`event:${slug}:signup`)
      .setLabel('INSCREVA-SE')
      .setStyle(ButtonStyle.Success),
  ];

  if (config?.linkButton?.url && config.linkButton.label) {
    buttons.push(
      new ButtonBuilder()
        .setLabel(config.linkButton.label)
        .setURL(config.linkButton.url)
        .setStyle(ButtonStyle.Link)
    );
  }

  return [new ActionRowBuilder().addComponents(buttons)];
}

const VALID_FIELD_TYPES = ['short', 'paragraph', 'text_display', 'string_select', 'user_select', 'role_select', 'channel_select', 'mentionable_select'];

function fieldType(field) {
  const type = String(field.type || '').toLowerCase();
  if (VALID_FIELD_TYPES.includes(type)) return type;
  const legacy = String(field.style || '').toLowerCase();
  if (legacy === 'paragraph') return 'paragraph';
  return 'short';
}

function isTextFieldType(type) {
  return type === 'short' || type === 'paragraph';
}

function buildSignupModal(slug, config, existing = null) {
  const modal = new ModalBuilder()
    .setCustomId(`event:${slug}:modal`)
    .setTitle(config.modalTitle || 'Inscrição no evento');

  for (const field of config.fields) {
    const customId = `event:${slug}:field:${field.id}`;
    const type = fieldType(field);

    if (type === 'text_display') {
      modal.addTextDisplayComponents(new TextDisplayBuilder({ content: field.content || field.label || '' }));
      continue;
    }

    if (isTextFieldType(type)) {
      const textInput = new TextInputBuilder()
        .setCustomId(customId)
        .setStyle(type === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(field.required !== false)
        .setMaxLength(field.maxLength || 4000);
      if (existing?.values?.[field.id]) {
        textInput.setValue(String(existing.values[field.id]).slice(0, field.maxLength || 4000));
      }
      modal.addLabelComponents(new LabelBuilder().setLabel(field.label).setTextInputComponent(textInput));
      continue;
    }

    if (type === 'string_select') {
      const minV = field.required === false ? 0 : (field.minValues ?? 1);
      const select = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setOptions(field.options || [])
        .setMinValues(minV)
        .setMaxValues(field.maxValues ?? 1);
      if (field.placeholder) select.setPlaceholder(field.placeholder);
      modal.addLabelComponents(new LabelBuilder().setLabel(field.label).setStringSelectMenuComponent(select));
      continue;
    }

    if (type === 'user_select' || type === 'role_select' || type === 'channel_select' || type === 'mentionable_select') {
      const SelectClass = {
        user_select: UserSelectMenuBuilder,
        role_select: RoleSelectMenuBuilder,
        channel_select: ChannelSelectMenuBuilder,
        mentionable_select: MentionableSelectMenuBuilder,
      }[type];
      const select = new SelectClass().setCustomId(customId);
      if (field.placeholder) select.setPlaceholder(field.placeholder);
      modal.addLabelComponents(new LabelBuilder().setLabel(field.label).setComponent(select));
    }
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
  if (!isEventPostable(config)) {
    return interaction.reply({ content: 'Este evento ainda não possui campos de inscrição. Um administrador precisa adicioná-los.', flags: MessageFlags.Ephemeral });
  }
  const existing = getSignup(slug, interaction.user.id);
  const modal = buildSignupModal(slug, config, existing);
  logger.info(`Opening modal for ${slug}. Field types: ${config.fields.map(f => f.type || f.style).join(', ')}. Components: ${modal.components.map(c => c.type).join(', ')}`);
  try {
    await interaction.showModal(modal);
  } catch (error) {
    logger.error(`Failed to show modal for ${slug}: ${error.message}`, { modal, error });
    await interaction.reply({ content: `Não foi possível abrir o modal: ${error.message}`, flags: MessageFlags.Ephemeral });
  }
}

async function handleCancelButton(interaction, slug) {
  if (!hasSignup(slug, interaction.user.id)) {
    return interaction.reply({ content: 'Você ainda não está inscrito.', flags: MessageFlags.Ephemeral });
  }
  const displayName = interaction.member?.displayName || interaction.user.username;
  removeSignup(slug, interaction.user.id, displayName);
  const config = loadEventConfig(slug);
  if (!config) {
    return interaction.update({ content: 'Inscrição cancelada, mas a configuração do evento não foi encontrada.', components: [] });
  }
  await interaction.update({ embeds: [buildEventEmbed(slug, config)], components: buildButtonRow(slug, config) });
  await interaction.followUp({ content: '✅ Inscrição cancelada.', flags: MessageFlags.Ephemeral });
}

async function handleModalSubmit(interaction, slug) {
  const config = loadEventConfig(slug);
  if (!config) {
    return interaction.reply({ content: 'Configuração do evento não encontrada.', flags: MessageFlags.Ephemeral });
  }

  const values = {};
  for (const field of config.fields) {
    const type = fieldType(field);
    if (type === 'text_display') continue;

    const customId = `event:${slug}:field:${field.id}`;
    try {
      if (isTextFieldType(type)) {
        values[field.id] = interaction.fields.getTextInputValue(customId)?.trim() || '';
      } else if (type === 'string_select') {
        const selected = interaction.fields.getStringSelectValues(customId);
        values[field.id] = Array.isArray(selected) ? selected.join(', ') : '';
      } else if (type === 'user_select') {
        const users = interaction.fields.getSelectedUsers(customId);
        values[field.id] = users ? [...users.values()].map(u => `${u.username} (${u.id})`).join(', ') : '';
      } else if (type === 'role_select') {
        const roles = interaction.fields.getSelectedRoles(customId);
        values[field.id] = roles ? [...roles.values()].map(r => `${r.name} (${r.id})`).join(', ') : '';
      } else if (type === 'channel_select') {
        const channels = interaction.fields.getSelectedChannels(customId);
        values[field.id] = channels ? [...channels.values()].map(c => `${c.name || c.id} (${c.id})`).join(', ') : '';
      } else if (type === 'mentionable_select') {
        const mentionables = interaction.fields.getSelectedMentionables(customId);
        const parts = [];
        if (mentionables?.users) parts.push(...[...mentionables.users.values()].map(u => `${u.username} (${u.id})`));
        if (mentionables?.roles) parts.push(...[...mentionables.roles.values()].map(r => `${r.name} (${r.id})`));
        values[field.id] = parts.join(', ');
      }
    } catch (e) {
      logger.warn(`Failed to read modal field ${field.id} (${type}): ${e.message}`);
      values[field.id] = '';
    }
  }

  const displayName = interaction.member?.displayName || interaction.user.username;
  addOrUpdateSignup(slug, interaction.user.id, displayName, values);

  function formatConfirmation(config, values) {
    const lines = config.fields
      .filter(f => fieldType(f) !== 'text_display')
      .map(f => `${f.label}: ${values[f.id] || ''}`)
      .join('\n');
    return `# ✅ Inscrição confirmada!\n${lines}\n\n**Qualquer duvida chame um moderador!**`;
  }

  if (interaction.message) {
    await interaction.update({ embeds: [buildEventEmbed(slug, config)], components: buildButtonRow(slug, config) });
    await interaction.followUp({ content: formatConfirmation(config, values), flags: MessageFlags.Ephemeral });
  } else {
    await interaction.reply({ content: formatConfirmation(config, values), flags: MessageFlags.Ephemeral });
  }
}

module.exports = {
  eventSlug,
  loadEventConfig,
  saveEventConfig,
  deleteEventConfig,
  isEventPostable,
  listEventSlugs,
  readTrackedMessages,
  trackEventMessage,
  clearTrackedMessages,
  updatePostedMessages,
  buildEventEmbed,
  buildButtonRow,
  buildSignupModal,
  parseEventCustomId,
  handleSignupButton,
  handleCancelButton,
  handleModalSubmit,
};
