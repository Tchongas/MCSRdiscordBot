const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');


const getScores = async (player_one, player_two) => {
  const res = await fetch(`https://ranked-score.vercel.app/api/getScoresFromVersusScores/${player_one}/${player_two}`)
  if (!res.ok) {
    throw new Error("failed to fetch")
  }
  return res.json()
}

const getScoresPerSeason = async (player_one, player_two, season) => {
  const res = await fetch(`https://ranked-score.vercel.app/api/getScoresPerSeason/${player_one}/${player_two}`)
  if (!res.ok) {
    throw new Error("failed to fetch")
  }
  let data = await res.json();
  return {
    references: data.references,
    scores: data.scoresPerSeason.filter((_, index) => index === season - 1)[0]
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('compare')
    .setDescription('Visualize o score de dois jogadores')
    .addStringOption(opt => opt
      .setName('player_one')
      .setDescription('Nome do primeiro jogador')
      .setRequired(true)
    )
    .addStringOption(opt => opt
      .setName('player_two')
      .setDescription('Nome do segundo jogador')
      .setRequired(true)
    )
    .addNumberOption(opt => opt
      .setName('season')
      .setDescription('Número da season para comparação (opcional, padrão: todas as seasons)')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
  async execute(interaction) {
    const player_one = interaction.options.getString('player_one');
    const player_two = interaction.options.getString('player_two');
    const season = interaction.options.getNumber('season') || 'all';
    let embed;

    let allTimeScores = season == 'all'

    let data = allTimeScores ? await getScores(player_one, player_two) : await getScoresPerSeason(player_one, player_two, season)

    const player_one_id = data.references[player_one];
    const player_two_id = data.references[player_two];
    let winner;
    let emote1, emote2;
    let score1 = data.scores[player_one_id];
    let score2 = data.scores[player_two_id];

    if (score1 > score2) {
      winner = player_one_id;
      emote1 = "🏆";
      emote2 = "💀";
    } else if (score2 > score1) {
      winner = player_two_id;
      emote1 = "💀";
      emote2 = "🏆";
    } else {
      winner = player_one_id;
      emote1 = emote2 = "🤝";
    }


    embed = new EmbedBuilder()
      .setColor(Math.floor(Math.random() * 0xFFFFFF))
      .setAuthor({
        name: allTimeScores ? "⚔ Ranked All-Time Scores" : `⚔ Ranked Season Scores`,
      })
      .setTitle(`${player_one} 🆚 ${player_two}`)
      .setDescription(
        `**Season: ${allTimeScores ? 'Todas' : season}**\n\n` +
        `${emote1} **${player_one}:** ${data.scores[player_one_id]}\n` +
        `${emote2} **${player_two}:** ${data.scores[player_two_id]}`
      )
      .addFields(
        {
          name: "📊 Visualizar detalhes",
          value: `[Clique aqui](http://ranked-score.vercel.app/?runnerOne=${player_one}&runnerTwo=${player_two})`,
          inline: false,
        }
      )
      .setThumbnail(`https://mc-heads.net/head/${winner}`)
      .setFooter({ text: "• MCSR BR", iconURL: "https://media.discordapp.net/attachments/1003054589257465937/1414715516039205035/Cristal_Brasil.png?ex=68c093ff&is=68bf427f&hm=7c383f3f9ce5ac70aca98ff09bb9eacd613f259af97fdefe1baac2456d424f92&=&format=webp&quality=lossless&width=605&height=605" })
      .setTimestamp();

    await await interaction.reply({ embeds: [embed] });
  },
};
