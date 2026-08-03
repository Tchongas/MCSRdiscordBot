const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const {
  eventSlug,
  loadEventConfig,
  saveEventConfig,
  deleteEventConfig,
  isEventPostable,
  updatePostedMessages,
  buildEventEmbed,
  buildButtonRow,
} = require('../lib/eventSignups');

const HEX_COLOR = /^#?[0-9a-fA-F]{6}$/;
const VALID_FIELD_STYLES = ['short', 'paragraph'];
const ALLOWED_USER_IDS = ['904123221685702657'];

function canManageEvents(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (ALLOWED_USER_IDS.includes(interaction.user.id)) return true;
  return false;
}

function parseColor(value) {
  if (!value) return undefined;
  const hex = value.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  return value;
}

function parseHexColor(value) {
  if (!value) return undefined;
  const hex = value.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  return parseInt(hex, 16);
}

function parseFields(raw) {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('O campo "campos" precisa ser um array JSON com pelo menos um item.');
  }
  if (parsed.length > 5) {
    throw new Error('Máximo de 5 campos permitidos em um modal.');
  }
  return parsed.map((field, i) => normalizeField(field, i));
}

function normalizeField(field, index) {
  if (!field.id || typeof field.id !== 'string') {
    throw new Error(`Campo ${index + 1} precisa de um "id".`);
  }
  if (!field.label || typeof field.label !== 'string') {
    throw new Error(`Campo ${index + 1} precisa de um "label".`);
  }
  if (!/^[a-z0-9_]+$/.test(field.id)) {
    throw new Error(`Campo ${index + 1}: id "${field.id}" deve conter apenas letras minúsculas, números e underline.`);
  }
  const style = String(field.style || 'short').toLowerCase();
  if (!VALID_FIELD_STYLES.includes(style)) {
    throw new Error(`Campo ${index + 1}: style deve ser "short" ou "paragraph".`);
  }
  return {
    id: field.id,
    label: field.label,
    style,
    required: field.required !== false,
    maxLength: Number(field.maxLength) || 4000,
  };
}

function configInfoEmbed(slug, config) {
  const fieldsText = config.fields
    .map((f, i) => `${i + 1}. \`${f.id}\` — ${f.label} (${f.style}${f.required ? ', obrigatório' : ''})`)
    .join('\n') || 'Nenhum campo configurado.';

  const postable = isEventPostable(config) ? 'Sim' : 'Não';

  return new EmbedBuilder()
    .setTitle(`Config do evento: ${config.title || slug}`)
    .setDescription(config.description || 'Sem descrição.')
    .setColor(parseHexColor(config.color) || 0x00b894)
    .addFields(
      { name: 'Slug', value: slug, inline: true },
      { name: 'Pronto para postar', value: postable, inline: true },
      { name: 'Cor', value: config.color || 'padrão', inline: true },
      { name: 'Imagem', value: config.image || 'nenhuma', inline: true },
      { name: 'Campos', value: fieldsText, inline: false }
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eventconfig')
    .setDescription('Gerencia eventos de inscrição')

    .addSubcommand(sub => sub
      .setName('criar')
      .setDescription('Cria um novo evento')
      .addStringOption(opt => opt.setName('nome').setDescription('Nome curto do evento').setRequired(true))
      .addStringOption(opt => opt.setName('titulo').setDescription('Título do evento').setRequired(true))
      .addStringOption(opt => opt.setName('descricao').setDescription('Descrição curta do evento').setRequired(true))
      .addStringOption(opt => opt.setName('cor').setDescription('Cor do embed em hex, ex: #00b894'))
      .addStringOption(opt => opt.setName('imagem').setDescription('URL de uma imagem grande para o embed'))
      .addStringOption(opt => opt.setName('campos').setDescription('Array JSON dos campos do modal (opcional — pode usar /eventconfig campo adicionar depois)')))

    .addSubcommand(sub => sub
      .setName('deletar')
      .setDescription('Deleta um evento e suas inscrições')
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do evento').setRequired(true)))

    .addSubcommand(sub => sub
      .setName('editar')
      .setDescription('Edita nome, descrição, cor ou imagem do evento')
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do evento').setRequired(true))
      .addStringOption(opt => opt.setName('titulo').setDescription('Novo título'))
      .addStringOption(opt => opt.setName('descricao').setDescription('Nova descrição'))
      .addStringOption(opt => opt.setName('cor').setDescription('Nova cor em hex, ex: #ff0000'))
      .addStringOption(opt => opt.setName('imagem').setDescription('Nova URL de imagem (use "remover" para limpar)')))

    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('Mostra a configuração atual do evento')
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do evento').setRequired(true)))

    .addSubcommandGroup(group => group
      .setName('campo')
      .setDescription('Gerencia campos do evento')

      .addSubcommand(sub => sub
        .setName('adicionar')
        .setDescription('Adiciona um campo ao modal de inscrição')
        .addStringOption(opt => opt.setName('nome').setDescription('Nome do evento').setRequired(true))
        .addStringOption(opt => opt.setName('id').setDescription('ID interno do campo (ex: minecraft)').setRequired(true))
        .addStringOption(opt => opt.setName('label').setDescription('Texto do campo no modal').setRequired(true))
        .addStringOption(opt => opt.setName('style').setDescription('short ou paragraph').setRequired(false))
        .addBooleanOption(opt => opt.setName('obrigatorio').setDescription('Se o campo é obrigatório').setRequired(false))
        .addIntegerOption(opt => opt.setName('maxlength').setDescription('Máximo de caracteres').setRequired(false)))

      .addSubcommand(sub => sub
        .setName('remover')
        .setDescription('Remove um campo do modal de inscrição')
        .addStringOption(opt => opt.setName('nome').setDescription('Nome do evento').setRequired(true))
        .addStringOption(opt => opt.setName('id').setDescription('ID do campo').setRequired(true)))

      .addSubcommand(sub => sub
        .setName('editar')
        .setDescription('Edita um campo existente')
        .addStringOption(opt => opt.setName('nome').setDescription('Nome do evento').setRequired(true))
        .addStringOption(opt => opt.setName('id').setDescription('ID do campo').setRequired(true))
        .addStringOption(opt => opt.setName('label').setDescription('Novo texto do campo'))
        .addStringOption(opt => opt.setName('style').setDescription('short ou paragraph'))
        .addBooleanOption(opt => opt.setName('obrigatorio').setDescription('Se o campo é obrigatório'))
        .addIntegerOption(opt => opt.setName('maxlength').setDescription('Máximo de caracteres')))),

  async execute(interaction) {
    if (!canManageEvents(interaction)) {
      return interaction.reply({
        content: 'Você não tem permissão para gerenciar eventos.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    const name = interaction.options.getString('nome', true);
    const slug = eventSlug(name);

    if (sub === 'info') {
      const config = loadEventConfig(slug);
      if (!config) {
        return interaction.reply({ content: `Evento \`${slug}\` não encontrado.`, flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ embeds: [configInfoEmbed(slug, config)], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'deletar') {
      deleteEventConfig(slug);
      return interaction.reply({ content: `Evento \`${slug}\` deletado.`, flags: MessageFlags.Ephemeral });
    }

    if (sub === 'criar') {
      const title = interaction.options.getString('titulo', true);
      const description = interaction.options.getString('descricao', true);
      const color = parseColor(interaction.options.getString('cor'));
      const image = interaction.options.getString('imagem');
      const fieldsRaw = interaction.options.getString('campos');

      let fields = [];
      if (fieldsRaw) {
        try {
          fields = parseFields(fieldsRaw);
        } catch (e) {
          return interaction.reply({ content: `Erro nos campos: ${e.message}`, flags: MessageFlags.Ephemeral });
        }
      }

      const config = {
        title,
        description,
        color,
        image: image || undefined,
        modalTitle: `Inscrição: ${title}`,
        fields,
      };

      saveEventConfig(slug, config);

      const preview = isEventPostable(config)
        ? { embeds: [buildEventEmbed(slug, config)], components: buildButtonRow(slug) }
        : { content: 'Evento criado sem campos. Use `/eventconfig campo adicionar` antes de postar.' };

      return interaction.reply({
        content: `Evento \`${slug}\` criado. Use \`/evento nome:${name}\` para postar.`,
        ...preview,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'editar') {
      const config = loadEventConfig(slug);
      if (!config) {
        return interaction.reply({ content: `Evento \`${slug}\` não encontrado.`, flags: MessageFlags.Ephemeral });
      }

      const title = interaction.options.getString('titulo');
      if (title) config.title = title;

      const description = interaction.options.getString('descricao');
      if (description) config.description = description;

      const color = parseColor(interaction.options.getString('cor'));
      if (color !== undefined) config.color = color;

      const image = interaction.options.getString('imagem');
      if (image === 'remover') {
        delete config.image;
      } else if (image) {
        config.image = image;
      }

      if (title) config.modalTitle = `Inscrição: ${config.title}`;

      saveEventConfig(slug, config);
      const updatedCount = await updatePostedMessages(interaction.client, slug, config);
      const syncText = updatedCount > 0 ? ` ${updatedCount} mensagem(ns) postada(s) atualizada(s).` : '';
      return interaction.reply({
        content: `Evento \`${slug}\` atualizado.${syncText}`,
        embeds: [configInfoEmbed(slug, config)],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (group === 'campo') {
      const config = loadEventConfig(slug);
      if (!config) {
        return interaction.reply({ content: `Evento \`${slug}\` não encontrado.`, flags: MessageFlags.Ephemeral });
      }
      config.fields = Array.isArray(config.fields) ? config.fields : [];

      if (sub === 'adicionar') {
        const fieldId = interaction.options.getString('id', true).toLowerCase();
        if (config.fields.some(f => f.id === fieldId)) {
          return interaction.reply({ content: `Já existe um campo com id \`${fieldId}\`. Use \`/eventconfig campo editar\`.`, flags: MessageFlags.Ephemeral });
        }
        const newField = {
          id: fieldId,
          label: interaction.options.getString('label', true),
          style: String(interaction.options.getString('style') || 'short').toLowerCase(),
          required: interaction.options.getBoolean('obrigatorio') !== false,
          maxLength: interaction.options.getInteger('maxlength') || 4000,
        };
        try {
          config.fields.push(normalizeField(newField, config.fields.length));
        } catch (e) {
          return interaction.reply({ content: `Erro no campo: ${e.message}`, flags: MessageFlags.Ephemeral });
        }
        saveEventConfig(slug, config);
        const updatedCount = await updatePostedMessages(interaction.client, slug, config);
        const syncText = updatedCount > 0 ? ` ${updatedCount} mensagem(ns) postada(s) atualizada(s).` : '';
        return interaction.reply({ content: `Campo \`${fieldId}\` adicionado.${syncText}`, embeds: [configInfoEmbed(slug, config)], flags: MessageFlags.Ephemeral });
      }

      if (sub === 'remover') {
        const fieldId = interaction.options.getString('id', true).toLowerCase();
        const before = config.fields.length;
        config.fields = config.fields.filter(f => f.id !== fieldId);
        if (config.fields.length === before) {
          return interaction.reply({ content: `Campo \`${fieldId}\` não encontrado.`, flags: MessageFlags.Ephemeral });
        }
        saveEventConfig(slug, config);
        const updatedCount = await updatePostedMessages(interaction.client, slug, config);
        const syncText = updatedCount > 0 ? ` ${updatedCount} mensagem(ns) postada(s) atualizada(s).` : '';
        return interaction.reply({ content: `Campo \`${fieldId}\` removido.${syncText}`, embeds: [configInfoEmbed(slug, config)], flags: MessageFlags.Ephemeral });
      }

      if (sub === 'editar') {
        const fieldId = interaction.options.getString('id', true).toLowerCase();
        const field = config.fields.find(f => f.id === fieldId);
        if (!field) {
          return interaction.reply({ content: `Campo \`${fieldId}\` não encontrado.`, flags: MessageFlags.Ephemeral });
        }
        const label = interaction.options.getString('label');
        if (label) field.label = label;
        const style = interaction.options.getString('style');
        if (style) {
          const normalized = String(style).toLowerCase();
          if (!VALID_FIELD_STYLES.includes(normalized)) {
            return interaction.reply({ content: 'Style deve ser "short" ou "paragraph".', flags: MessageFlags.Ephemeral });
          }
          field.style = normalized;
        }
        const required = interaction.options.getBoolean('obrigatorio');
        if (required !== null) field.required = required;
        const maxLength = interaction.options.getInteger('maxlength');
        if (maxLength !== null) field.maxLength = maxLength;
        saveEventConfig(slug, config);
        const updatedCount = await updatePostedMessages(interaction.client, slug, config);
        const syncText = updatedCount > 0 ? ` ${updatedCount} mensagem(ns) postada(s) atualizada(s).` : '';
        return interaction.reply({ content: `Campo \`${fieldId}\` atualizado.${syncText}`, embeds: [configInfoEmbed(slug, config)], flags: MessageFlags.Ephemeral });
      }
    }

    return interaction.reply({ content: 'Subcomando não reconhecido.', flags: MessageFlags.Ephemeral });
  },
};
