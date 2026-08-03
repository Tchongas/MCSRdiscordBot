const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { eventSlug, loadEventConfig, isEventPostable, trackEventMessage, buildEventEmbed, buildButtonRow } = require('../lib/eventSignups');

const ALLOWED_USER_IDS = ['904123221685702657'];

function canPostEvent(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (ALLOWED_USER_IDS.includes(interaction.user.id)) return true;
  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('evento')
    .setDescription('Posta o embed de inscrição para um evento')
    .addStringOption(opt => opt
      .setName('nome')
      .setDescription('Nome do evento')
      .setRequired(true)
    ),

  async execute(interaction) {
    if (!canPostEvent(interaction)) {
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
        content: `Evento "${name}" (slug: \`${slug}\`) não encontrado. Crie-o com \`/eventconfig criar\`.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!isEventPostable(config)) {
      return interaction.reply({
        content: `O evento \`${slug}\` existe, mas ainda não tem campos de inscrição. Use \`/eventconfig campo adicionar\`.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply({
      embeds: [buildEventEmbed(slug, config)],
      components: buildButtonRow(slug),
    });

    try {
      const message = await interaction.fetchReply();
      trackEventMessage(slug, message);
    } catch (e) {
      // Ignore tracking failures — the event is still posted.
    }
  },
};
