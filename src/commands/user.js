const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('Displays info about the user who invoked the command'),
  async execute(interaction) {
    const user = interaction.user;
    await interaction.reply({
      content: `Your tag: ${user.tag}\nYour id: ${user.id}`,
      ephemeral: true,
    });
  },
};
