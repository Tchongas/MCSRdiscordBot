const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const economy = require('../lib/economy');
const betting = require('../lib/betting');

function formatDateBR(input) {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

// UI emojis
const EMOJI = {
  coin: '🪙',
  list: '📜',
  calendar: '📅',
  ticket: '🎟️',
  check: '✅',
  x: '❌',
  star: '⭐',
  trophy: '🏆',
  money: '💰',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mcsrbet')
    .setDescription('Apostas de MCSR')
    .addSubcommand(sc => sc
      .setName('apostas')
      .setDescription('Listar apostas abertas'))
    .addSubcommand(sc => sc
      .setName('apostar')
      .setDescription('Apostar em um evento')
      .addStringOption(o => o.setName('event')
        .setDescription('ID do evento')
        .setRequired(true)
        .setAutocomplete(true))
      .addStringOption(o => o.setName('option')
        .setDescription('Opção para apostar')
        .setRequired(true)
        .setAutocomplete(true))
      .addIntegerOption(o => o.setName('valor')
        .setDescription('Valor da aposta')
        .setMinValue(1)
        .setRequired(true)))
    .addSubcommand(sc => sc
      .setName('minhasapostas')
      .setDescription('Mostrar suas apostas ativas'))
    .addSubcommand(sc => sc
      .setName('ajuda')
      .setDescription('Como usar as apostas')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    try {

      if (sub === 'apostas') {
        // Try to refresh if cache is empty; otherwise use cache
        const cache = betting.listOpenEvents();
        let items = cache;
        if (items.length === 0) items = await betting.refreshEvents();
        const open = betting.listOpenEvents();
        if (open.length === 0) {
          return interaction.reply({ content: 'Nenhuma aposta aberta agora.', ephemeral: true });
        }
        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle(`${EMOJI.list} Apostas Abertas`)
          .setDescription('Veja os eventos disponíveis e suas opções')
          .setTimestamp(new Date());
        open.slice(0, 10).forEach((e, idx) => {
          const fecha = e.closesAt ? formatDateBR(e.closesAt) : null;
          const totals = betting.totalsForEvent(e.id);
          const optionLines = e.options.map(opt => {
            const v = totals.optionTotals?.[opt] || 0;
            return `${opt} — ${v.toLocaleString('pt-BR')} ${EMOJI.coin}`;
          }).join(' | ');
          const pool = totals.totalAll || 0;
          const value = `**${e.title}**\n${EMOJI.ticket} **Opções:** ${optionLines}${fecha ? `\n${EMOJI.calendar} **Fecha:** ${fecha}` : ''}\nTotal apostado: **${pool.toLocaleString('pt-BR')}** ${EMOJI.coin}`;
          embed.addFields({ name: `#${idx + 1} • ID: ${e.id}`, value, inline: false });
        });
        return interaction.reply({ embeds: [embed], ephemeral: false });
      }

      if (sub === 'aposta' || sub === 'apostar') {
        const eventId = interaction.options.getString('event', true);
        const option = interaction.options.getString('option', true);
        const amount = interaction.options.getInteger('valor', true);

        // ensure sufficient balance
        const bal = economy.getBalance(userId);
        if (amount > bal) {
          return interaction.reply({ content: `Saldo insuficiente. Seu saldo é ${bal}.`, ephemeral: true });
        }
        // ensure event exists (refresh cache if missing)
        let ev = betting.getEventById(eventId);
        if (!ev) {
          await betting.refreshEvents();
          ev = betting.getEventById(eventId);
        }
        if (!ev) return interaction.reply({ content: 'Aposta não encontrada.', ephemeral: true });

        try {
          const bet = betting.placeBet({ userId, eventId, option, amount });
          economy.addBalance(userId, -amount);
          const embed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(`${EMOJI.check} Aposta Confirmada`)
            .addFields(
              { name: `${EMOJI.ticket} Evento`, value: `**${ev.title}** (ID: ${ev.id})` },
              { name: 'Opção', value: option, inline: true },
              { name: `${EMOJI.coin} Valor`, value: `${amount.toLocaleString('pt-BR')} moedas`, inline: true },
            )
            .setFooter({ text: ev.closesAt ? `${EMOJI.calendar} Fecha: ${formatDateBR(ev.closesAt)}` : 'Sem data de fechamento' })
            .setTimestamp(new Date());
          return interaction.reply({ embeds: [embed], ephemeral: false });
        } catch (e) {
          return interaction.reply({ content: `Erro ao fazer aposta: ${e.message}`, ephemeral: true });
        }
      }

      if (sub === 'minhasapostas') {
        const bets = betting.getUserBets(userId, { includeSettled: false });
        if (bets.length === 0) return interaction.reply({ content: 'Você não tem apostas ativas.', ephemeral: true });
        // Best effort: enrich with event titles from cache
        const embed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(`${EMOJI.star} Suas Apostas Ativas`)
          .setTimestamp(new Date());
        for (const b of bets.slice(0, 10)) {
          const ev = betting.getEventById(b.eventId);
          const created = formatDateBR(b.createdAt);
          const title = ev?.title ? ev.title : `Evento ${b.eventId}`;
          const footer = ev?.closesAt ? `${EMOJI.calendar} Fecha: ${formatDateBR(ev.closesAt)}` : '';
          const value = `${EMOJI.ticket} **${title}** (ID: ${b.eventId})\nOpção: ${b.option}\n${EMOJI.coin} Valor: ${b.amount.toLocaleString('pt-BR')} moedas\nCriada: ${created}${footer ? `\n${footer}` : ''}`;
          embed.addFields({ name: `Aposta`, value, inline: false });
        }
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      

      if (sub === 'ajuda') {
        const embed = new EmbedBuilder()
          .setColor(0x95a5a6)
          .setTitle('ℹ️ Ajuda — Apostas MCSR')
          .setDescription('Como usar os comandos de apostas:')
          .addFields(
            { name: `${EMOJI.list} /mcsrbet apostas`, value: 'Lista as apostas abertas' },
            { name: `${EMOJI.ticket} /mcsrbet apostar`, value: 'Selecione a **aposta**, a **opção**, e informe o **valor**.' },
            { name: `👤 /conta`, value: 'Mostra seu saldo atual.' },
            { name: `⭐ /mcsrbet minhasapostas`, value: 'Lista suas apostas ativas com título do evento e datas.' },
            { name: `${EMOJI.trophy} /ranking`, value: 'Mostra o ranking por saldo.' },
            { name: `${EMOJI.money} /daily`, value: 'Receba 50 moedas diariamente se responder uma pergunta corretamente.' }
          )
          .setFooter({ text: 'Payout: sistema pari-mutuel — vencedores dividem o pote dos perdedores proporcionalmente ao valor apostado.' })
          .setTimestamp(new Date());
        return interaction.reply({ embeds: [embed]});
      }

      return interaction.reply({ content: 'Subcomando desconhecido', ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: 'Ocorreu um erro ao processar sua solicitação.', ephemeral: true });
    }
  },
  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused(true);
      const name = focused?.name;
      const query = String(focused?.value ?? '').toLowerCase();
      let choices = [];

      // Ensure we have events in cache
      let events = betting.listOpenEvents();
      if (events.length === 0) {
        try { events = await betting.refreshEvents(); } catch {}
        events = betting.listOpenEvents();
      }

      if (name === 'event') {
        const filtered = events.filter(e => {
          if (!query) return true;
          return String(e.id).toLowerCase().includes(query) || String(e.title).toLowerCase().includes(query);
        });
        choices = filtered.slice(0, 25).map(e => ({ name: `ID: ${e.id} — ${e.title}`.slice(0, 100), value: String(e.id) }));
      } else if (name === 'option') {
        const selectedEventId = interaction.options.getString('event');
        let ev = selectedEventId ? betting.getEventById(selectedEventId) : null;
        if (!ev && selectedEventId) {
          // Fallback: try to find by title match if user typed a title into event (unlikely with autocomplete)
          ev = events.find(e => String(e.title).toLowerCase().includes(String(selectedEventId).toLowerCase()));
        }
        const opts = ev?.options ?? [];
        const filtered = opts.filter(o => !query || o.toLowerCase().includes(query));
        choices = filtered.slice(0, 25).map(o => ({ name: o, value: o }));
      }

      await interaction.respond(choices);
    } catch (err) {
      // Swallow autocomplete errors silently to avoid noisy logs for users
      try { await interaction.respond([]); } catch {}
    }
  }
};