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
const SIGNUPS_FILE = path.join(EVENTS_DIR, 'signups.json');

const BUTTON_SIGNUP = 'event:signup';
const BUTTON_CANCEL = 'event:cancel';
const MODAL_SIGNUP = 'event:signup_modal';
const INPUT_MINECRAFT = 'event:minecraft';
const INPUT_PIZZA = 'event:pizza';
const INPUT_NOTES = 'event:notes';

function ensureStorage() {
  if (!fs.existsSync(EVENTS_DIR)) {
    fs.mkdirSync(EVENTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(SIGNUPS_FILE)) {
    fs.writeFileSync(SIGNUPS_FILE, JSON.stringify({ signups: {} }, null, 2), 'utf-8');
  }
}

function readSignups() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(SIGNUPS_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!data || typeof data.signups !== 'object') {
      return { signups: {} };
    }
    return data;
  } catch (e) {
    logger.error('Failed to read event signups:', e);
    return { signups: {} };
  }
}

function writeSignups(data) {
  ensureStorage();
  try {
    fs.writeFileSync(SIGNUPS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    logger.error('Failed to write event signups:', e);
  }
}

function hasSignup(userId) {
  return userId in readSignups().signups;
}

function getSignup(userId) {
  return readSignups().signups[userId] || null;
}

function addOrUpdateSignup(userId, displayName, fields) {
  const data = readSignups();
  data.signups[userId] = {
    displayName,
    minecraft: fields.minecraft || '',
    pizza: fields.pizza || '',
    notes: fields.notes || '',
    updatedAt: new Date().toISOString(),
  };
  writeSignups(data);
}

function removeSignup(userId) {
  const data = readSignups();
  delete data.signups[userId];
  writeSignups(data);
}

function getSignupList() {
  return Object.entries(readSignups().signups).map(([userId, s]) => ({ userId, ...s }));
}

function buildEventEmbed() {
  const signups = getSignupList();
  const embed = new EmbedBuilder()
    .setTitle('🎉 Inscrição para o evento')
    .setDescription('Evento de teste. Clique no botão abaixo para se inscrever!')
    .setColor(0x00b894)
    .setTimestamp();

  if (signups.length === 0) {
    embed.addFields({ name: 'Participantes', value: 'Nenhuma inscrição ainda.', inline: false });
  } else {
    const list = signups
      .map((s, i) => `${i + 1}. <@${s.userId}> — **${s.minecraft}** | Pizza: ${s.pizza}${s.notes ? ` | ${s.notes}` : ''}`)
      .join('\n');
    embed.addFields({ name: `Participantes (${signups.length})`, value: list, inline: false });
  }

  return embed;
}

function buildButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_SIGNUP)
      .setLabel('Inscrever-se')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BUTTON_CANCEL)
      .setLabel('Cancelar inscrição')
      .setStyle(ButtonStyle.Danger)
  );
}

function buildSignupModal(isEdit = false, existing = null) {
  const modal = new ModalBuilder()
    .setCustomId(MODAL_SIGNUP)
    .setTitle(isEdit ? 'Editar inscrição' : 'Inscrever-se no evento');

  const minecraftInput = new TextInputBuilder()
    .setCustomId(INPUT_MINECRAFT)
    .setLabel('Minecraft username')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(32);
  if (existing?.minecraft) minecraftInput.setValue(existing.minecraft);

  const pizzaInput = new TextInputBuilder()
    .setCustomId(INPUT_PIZZA)
    .setLabel('Pizza favorita')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(64);
  if (existing?.pizza) pizzaInput.setValue(existing.pizza);

  const notesInput = new TextInputBuilder()
    .setCustomId(INPUT_NOTES)
    .setLabel('Observações')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);
  if (existing?.notes) notesInput.setValue(existing.notes);

  modal.addComponents(
    new ActionRowBuilder().addComponents(minecraftInput),
    new ActionRowBuilder().addComponents(pizzaInput),
    new ActionRowBuilder().addComponents(notesInput)
  );

  return modal;
}

async function handleSignupButton(interaction) {
  const existing = getSignup(interaction.user.id);
  const modal = buildSignupModal(!!existing, existing);
  await interaction.showModal(modal);
}

async function handleCancelButton(interaction) {
  if (!hasSignup(interaction.user.id)) {
    return interaction.reply({ content: 'Você ainda não está inscrito.', flags: MessageFlags.Ephemeral });
  }
  removeSignup(interaction.user.id);
  await interaction.update({ embeds: [buildEventEmbed()], components: [buildButtonRow()] });
}

async function handleModalSubmit(interaction) {
  const minecraft = interaction.fields.getTextInputValue(INPUT_MINECRAFT).trim();
  const pizza = interaction.fields.getTextInputValue(INPUT_PIZZA).trim();
  const notes = interaction.fields.getTextInputValue(INPUT_NOTES)?.trim() || '';
  const displayName = interaction.member?.displayName || interaction.user.username;

  addOrUpdateSignup(interaction.user.id, displayName, { minecraft, pizza, notes });

  if (interaction.message) {
    await interaction.update({ embeds: [buildEventEmbed()], components: [buildButtonRow()] });
  } else {
    await interaction.reply({ content: 'Inscrição salva!', flags: MessageFlags.Ephemeral });
  }
}

module.exports = {
  buildEventEmbed,
  buildButtonRow,
  buildSignupModal,
  handleSignupButton,
  handleCancelButton,
  handleModalSubmit,
  BUTTON_SIGNUP,
  BUTTON_CANCEL,
  MODAL_SIGNUP,
};
