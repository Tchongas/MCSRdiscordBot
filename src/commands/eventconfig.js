const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const {
  eventSlug,
  saveEventConfig,
  deleteEventConfig,
  loadEventConfig,
  buildEventEmbed,
  buildButtonRow,
} = require('../lib/eventSignups');

const HEX_COLOR = /^#?[0-9a-fA-F]{6}$/;
const VALID_FIELD_STYLES = ['short', 'paragraph'];

function parseFields(raw) {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('O campo "campos" precisa ser um array JSON com pelo menos um item.');
  }
  if (parsed.length > 5) {
    throw new Error('Máximo de 5 campos permitidos em um modal.');
  }
  return parsed.map((field, i) => {
    if (!field.id || typeof field.id !== 'string') {
      throw new Error(`Campo ${i + 1} precisa de um "id".`);
    }
    if (!field.label || typeof field.label !== 'string') {
      throw new Error(`Campo ${i + 1} precisa de um "label".`);
    }
    if (!/^[a-z0-9_]+$/.test(field.id)) {
      throw new Error(`Campo ${i + 1}: id "${field.id}" deve conter apenas letras minúsculas, números e underline.`);
    }
    const style = String(field.style || 'short').toLowerCase();
    if (!VALID_FIELD_STYLES.includes(style)) {
      throw new Error(`Campo ${i + 1}: style deve ser "short" ou "paragraph".`);
    }
    return {
      id: field.id,
      label: field.label,
      style,
      required: field.required !== false,
      maxLength: Number(field.maxLength) || 4000,
    };
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eventconfig')
    .setDescription('Gerencia eventos de inscrição')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('criar')
      .setDescription('Cria ou atualiza um evento')
      .addStringOption(opt => opt.setName('nome').setDescription('Nome curto do evento (sem espaços especiais)').setRequired(true))
      .addStringOption(opt => opt.setName('titulo').setDescription('Título do evento').setRequired(true))
      .addStringOption(opt => opt.setName('descricao').setDescription('Descrição curta do evento').setRequired(true))
      .addStringOption(opt => opt.setName('campos').setDescription('Array JSON dos campos do modal (id, label, style, required, maxLength)').setRequired(true))
      .addStringOption(opt => opt.setName('cor').setDescription('Cor do embed em hex, ex: #00b894'))
      .addStringOption(opt => opt.setName('imagem').setDescription('URL de uma imagem grande para o embed'))
    )
    .addSubcommand(sub => sub
      .setName('deletar')
      .setDescription('Deleta um evento e suas inscrições')
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do evento').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const name = interaction.options.getString('nome', true);
    const slug = eventSlug(name);

    if (sub === 'deletar') {
      deleteEventConfig(slug);
      return interaction.reply({
        content: `Evento \`${slug}\` deletado.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const title = interaction.options.getString('titulo', true);
    const description = interaction.options.getString('descricao', true);
    const colorRaw = interaction.options.getString('cor');
    const image = interaction.options.getString('imagem');
    const fieldsRaw = interaction.options.getString('campos', true);

    let fields;
    try {
      fields = parseFields(fieldsRaw);
    } catch (e) {
      return interaction.reply({
        content: `Erro nos campos: ${e.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const color = HEX_COLOR.test(colorRaw || '') ? colorRaw : undefined;

    const config = {
      title,
      description,
      color,
      image: image || undefined,
      modalTitle: `Inscrição: ${title}`,
      fields,
    };

    saveEventConfig(slug, config);

    return interaction.reply({
      content: `Evento \`${slug}\` criado. Use \`/evento nome:${name}\` para postar o embed.`,
      embeds: [buildEventEmbed(slug, config)],
      components: buildButtonRow(slug),
      flags: MessageFlags.Ephemeral,
    });
  },
};
