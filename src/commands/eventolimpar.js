const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { eventSlug, loadEventConfig, listEventSlugs, clearTrackedMessages, readTrackedMessages } = require('../lib/eventSignups');

const ALLOWED_USER_IDS = ['904123221685702657'];

function canClearEvent(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (ALLOWED_USER_IDS.includes(interaction.user.id)) return true;
  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eventolimpar')
    .setDescription('Apaga as mensagens postadas de um evento e para de rastreá-las')
    .addStringOption(opt => opt
      .setName('nome')
      .setDescription('Nome do evento')
      .setRequired(true)
      .setAutocomplete(true)
    ),

  async execute(interaction) {
    if (!canClearEvent(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para usar este comando.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const name = interaction.options.getString('nome', true);
    const slug = eventSlug(name);

    const config = loadEventConfig(slug);
    if (!config) {
      return interaction.reply({
        content: `Evento \`${slug}\` não encontrado.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const messages = readTrackedMessages(slug);
    if (!messages.length) {
      return interaction.reply({
        content: `Nenhuma mensagem rastreada para \`${slug}\`.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    let deleted = 0;
    let failed = 0;

    for (const record of messages) {
      try {
        const channel = await interaction.client.channels.fetch(record.channelId);
        if (!channel) {
          failed++;
          continue;
        }
        const message = await channel.messages.fetch(record.messageId);
        if (message) {
          await message.delete();
          deleted++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    clearTrackedMessages(slug);

    return interaction.reply({
      content: `Mensagens de \`${slug}\` apuradas: **${deleted}** apagada(s), **${failed}** falha(s). Rastreamento limpo.`,
      flags: MessageFlags.Ephemeral,
    });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const slugs = listEventSlugs();
    const filtered = slugs.filter(s => s.toLowerCase().includes(focused.value.toLowerCase()));
    await interaction.respond(filtered.map(slug => ({ name: slug, value: slug })).slice(0, 25));
  },
};
