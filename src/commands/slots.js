//slots
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const economy = require('../lib/economy');

// Config
const COST = 25;
const CONSOLATION = Number(process.env.SLOTS_CONSOLATION || 10); // small refund for two-of-a-kind
const FORCE_TRIPLE = Math.max(0, Math.min(1, Number(process.env.SLOTS_FORCE_TRIPLE ?? 0.25))); // probability to force 3-of-a-kind
const FORCE_PAIR = Math.max(0, Math.min(1, Number(process.env.SLOTS_FORCE_PAIR ?? 0.35)));   // additional probability to force 2-of-a-kind
const HOUSE_ID = process.env.SLOTS_HOUSE_ID || '1376581368510939137';

// Visuals from env: these can be animated custom emojis configured in .env
const SLOT1 = process.env.SLOT1_EMOJI || '🎰';
const SLOT2 = process.env.SLOT2_EMOJI || '🎰';
const SLOT3 = process.env.SLOT3_EMOJI || '🎰';
const LOSE = process.env.LOSE_EMOJI || '❌';
const WIN = process.env.WIN_EMOJI || '🏆';
const LOGO = process.env.LOGO_EMOJI || '🎰';
const CLOCK = process.env.CLOCK_EMOJI || '🕒';
const FF = process.env.FF_EMOJI || '❌';

const STRING = process.env.STRING_EMOJI || '🎰'
const SOULSAND = process.env.SOULSAND_EMOJI || '🪙';
const QUARTZ = process.env.QUARTZ_EMOJI || '💎';
const POTION = process.env.POTION_EMOJI || '🧪';
const PEARL = process.env.PEARL_EMOJI || 'PEARL';
const HEAD = process.env.HEAD_EMOJI || 'HEAD';
const GRAVEL = process.env.GRAVEL_EMOJI || 'GRAVEL';
const CRYINGOBI = process.env.CRYINGOBI_EMOJI || 'CRYINGOBI';
const COURO = process.env.COURO_EMOJI || 'COURO';

// Define symbols with rarity (weight) and multipliers for 3-of-a-kind
// Multipliers stay within {2,4,8,16}
// More symbols, slightly higher common weights => easier to hit matches overall
const SYMBOLS = [
  // Common (2x) — split total weight across more symbols to lower p_i^3
  { emoji: `${QUARTZ}`, weight: 17, mult: 2 },
  { emoji: `${SOULSAND}`, weight: 17, mult: 2 },
  { emoji: `${GRAVEL}`, weight: 17, mult: 2 },
  { emoji: `${COURO}`, weight: 17, mult: 2 },
  // Uncommon (4x)
  { emoji: `${CRYINGOBI}`, weight: 12, mult: 4 },
  { emoji: `${STRING}`, weight: 12, mult: 4 },
  // Rare (8x)
  { emoji: `${PEARL}`, weight: 6, mult: 8 },
  { emoji: `${POTION}`, weight: 5, mult: 8 },
  // Ultra (16x) — very low so big payouts are rare
  { emoji: `${HEAD}`, weight: 2, mult: 16 },
  { emoji: `${LOGO}`, weight: 2, mult: 16 },
];

function pickWeighted() {
  const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const s of SYMBOLS) {
    if ((r -= s.weight) <= 0) return s;
  }
  return SYMBOLS[0];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickDifferent(exceptEmoji) {
  let s = pickWeighted();
  let guard = 0;
  while (s.emoji === exceptEmoji && guard++ < 10) s = pickWeighted();
  return s;
}

function generateResult() {
  const roll = Math.random();
  if (roll < FORCE_TRIPLE) {
    const s = pickWeighted();
    return [s, s, s];
  }
  if (roll < FORCE_TRIPLE + FORCE_PAIR) {
    const s = pickWeighted();
    // force a pair at two random positions, third is different
    const oddIdx = randInt(0, 2);
    const t = pickDifferent(s.emoji);
    const arr = [s, s, s];
    arr[oddIdx] = t;
    return arr;
  }
  // unbiased
  return [pickWeighted(), pickWeighted(), pickWeighted()];
}

function isTwoOfAKind(result) {
  const [a, b, c] = result.map(x => x.emoji);
  return (a === b && b !== c) || (a === c && b !== c) || (b === c && a !== b);
}

function resultPayout(result) {
  // 3-of-a-kind
  if (result[0].emoji === result[1].emoji && result[1].emoji === result[2].emoji) {
    return COST * result[0].mult;
  }
  // small consolation for 2-of-a-kind
  if (isTwoOfAKind(result) && CONSOLATION > 0) return CONSOLATION;
  return 0;
}

function formatReels(reels) {
  return reels.map(r => typeof r === 'string' ? r : r.emoji).join('   ');
}

function renderSimple(reels, footer) {
  const title = `# ${WIN} SLOT MACHINE ${LOSE}`;
  const line = `# ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎ ‎${formatReels(reels)}`;
  const foot = footer ? `\n${footer}` : '';
  return `${title}\n${line}${foot}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('🎰 Slot machine — custa 25 moedas por jogada'),
  async execute(interaction) {
    const userId = interaction.user.id;

    // Check balance
    const bal = economy.getBalance(userId);
    if (bal < COST) {
      return interaction.reply({ content: `Saldo insuficiente. Você precisa de ${COST} moedas para jogar. Saldo atual: ${bal}.`, ephemeral: true });
    }

    // Charge cost up front (send to house)
    economy.addBalance(userId, -COST);
    economy.addBalance(HOUSE_ID, COST);

    const stopId = `slots:stop:${userId}:${Date.now()}`;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(stopId).setLabel('Parar').setStyle(ButtonStyle.Danger)
    );

    // Initial reels using env-configured spinning emojis
    let reels = [SLOT1, SLOT2, SLOT3];

    await interaction.reply({
      content: renderSimple(reels, `Custa ${COST} 🪙 — Clique em Parar`),
      components: [row],
    });
    const message = await interaction.fetchReply();

    // Wait for the button from the same user
    let collected = null;
    try {
      collected = await message.awaitMessageComponent({
        filter: (i) => i.customId === stopId && i.user.id === userId,
        time: 15000,
      });
    } catch {}

    // Stop: remove the button entirely before revealing results

    // Determine final results
    const final = generateResult();

    // If user clicked the button, acknowledge/update; else just edit the message.
    // Always include content in every edit to ensure all lines update together.
    const applyEdit = async (payload) => {
      try {
        if (collected) {
          await collected.update(payload);
          collected = null; // after first update, switch to message.edit for subsequent edits
        }
        await message.edit(payload);
      } catch {}
    };

    // Reveal one by one
    await applyEdit({ content: renderSimple([final[0], SLOT2, SLOT3], 'Revelando...'), components: [] });
    await new Promise(r => setTimeout(r, 600));
    await applyEdit({ content: renderSimple([final[0], final[1], SLOT3], 'Quase lá...'), components: [] });
    await new Promise(r => setTimeout(r, 600));
    await applyEdit({ content: renderSimple([final[0], final[1], final[2]], 'Resultado!'), components: [] });

    const payout = resultPayout(final);
    if (payout > 0) {
      // Pay from house to player
      economy.addBalance(HOUSE_ID, -payout);
      economy.addBalance(userId, payout);
    }
    const newBal = economy.getBalance(userId);

    const isWin = payout > 0;
    const isThree = (final[0].emoji === final[1].emoji && final[1].emoji === final[2].emoji);
    const mult = isThree ? final[0].mult : 0;
    const footer = isThree
      ? `### ${WIN} Trinca de ${final[0].emoji} (×${mult}) — Você ganhou ${payout} 🪙\nSaldo: ${newBal} 🪙`
      : isWin
        ? `### ${FF} Dupla! Você recuperou ${payout} 🪙\nSaldo: ${newBal} 🪙`
        : `### ${LOSE} Você perdeu ${COST} 🪙\nSaldo: ${newBal} 🪙`;
    try { await message.edit({ content: renderSimple([final[0], final[1], final[2]], footer), components: [] }); } catch {}
  },
};