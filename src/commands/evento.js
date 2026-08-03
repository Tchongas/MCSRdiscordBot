const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildEventEmbed, buildButtonRow } = require('../lib/eventSignups');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('evento')
    .setDescription('Posta o embed de inscrição para o evento de teste')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.reply({
      embeds: [buildEventEmbed()],
      components: [buildButtonRow()],
    });
  },
};
