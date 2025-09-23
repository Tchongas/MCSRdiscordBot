const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economy = require('../lib/economy');

const EMOJI = {
  coin: '🪙',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('conta')
    .setDescription('Ver seu saldo'),
  async execute(interaction) {
    const userId = interaction.user.id;
    const bal = economy.getBalance(userId);

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`${EMOJI.coin} Sua Conta`)
      .setDescription(`Saldo disponível: **${bal.toLocaleString('pt-BR')}** ${EMOJI.coin}`)
      .setTimestamp(new Date());

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
