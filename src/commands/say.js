const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something')
    .addStringOption(opt => opt
      .setName('text')
      .setDescription('What should I say?')
      .setRequired(true))
    .addBooleanOption(opt => opt
      .setName('ephemeral')
      .setDescription('Only you can see the response?'))
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
  async execute(interaction) {
    const text = interaction.options.getString('text', true);
    const ephemeral = interaction.options.getBoolean('ephemeral') ?? false;
    await interaction.reply({ content: text, ephemeral });
  },
};
