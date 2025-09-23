const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const economy = require('../lib/economy');

const EMOJI = {
  coin: '🪙',
  trophy: '🏆',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Mostrar o ranking por saldo'),
  async execute(interaction) {
    const top = economy.top(10);
    if (top.length === 0) {
      return interaction.reply({ content: 'Sem dados.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle(`${EMOJI.trophy} Ranking de Moedas`)
      .setDescription(top.map((r, i) => `#${i + 1} <@${r.userId}> — **${r.balance.toLocaleString('pt-BR')}** ${EMOJI.coin}`).join('\n'))
      .setTimestamp(new Date());

    return interaction.reply({ embeds: [embed], ephemeral: false });
  },
};
