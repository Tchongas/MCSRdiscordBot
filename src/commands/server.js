const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Displays info about this server'),
  async execute(interaction) {
    const { guild } = interaction;
    if (!guild) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    await interaction.reply({
      content: `Server name: ${guild.name}\nTotal members: ${guild.memberCount}`,
      ephemeral: true,
    });
  },
};
