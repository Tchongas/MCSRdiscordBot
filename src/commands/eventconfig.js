const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const {
  eventSlug,
  loadEventConfig,
  saveEventConfig,
  deleteEventConfig,
  isEventPostable,
  listEventSlugs,
  updatePostedMessages,
  buildEventEmbed,
  buildButtonRow,
} = require('../lib/eventSignups');
const logger = require('../lib/logger');

const HEX_COLOR = /^#?[0-9a-fA-F]{6}$/;
const VALID_FIELD_TYPES = ['short', 'paragraph', 'text_display', 'string_select', 'user_select', 'role_select', 'channel_select', 'mentionable_select'];
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
  if (!/^[a-z0-9_]+$/.test(field.id)) {
    throw new Error(`Campo ${index + 1}: id "${field.id}" deve conter apenas letras minúsculas, números e underline.`);
  }

  let type = String(field.type || '').toLowerCase();
  if (!type) {
    const legacy = String(field.style || '').toLowerCase();
    type = legacy === 'paragraph' ? 'paragraph' : 'short';
  }
  if (!VALID_FIELD_TYPES.includes(type)) {
    throw new Error(`Campo ${index + 1}: tipo deve ser um de: ${VALID_FIELD_TYPES.join(', ')}.`);
  }

  const normalized = {
    id: field.id,
    type,
    required: field.required !== false,
  };

  if (type === 'text_display') {
    normalized.content = field.content || field.label || '';
    return normalized;
  }

  if (!field.label || typeof field.label !== 'string') {
    throw new Error(`Campo ${index + 1} precisa de um "label".`);
  }
  normalized.label = field.label;

  if (type === 'short' || type === 'paragraph') {
    normalized.style = type === 'paragraph' ? 'paragraph' : 'short';
    normalized.maxLength = Number(field.maxLength) || 4000;
  }

  if (type === 'string_select') {
    const options = Array.isArray(field.options) ? field.options : [];
    if (options.length === 0) {
      throw new Error(`Campo ${index + 1}: campos do tipo seleção de texto precisam de opções.`);
    }
    normalized.options = options.map((opt, i) => {
      if (!opt.label || !opt.value) {
        throw new Error(`Campo ${index + 1}, opção ${i + 1}: label e value são obrigatórios.`);
      }
      return { label: String(opt.label), value: String(opt.value), description: opt.description ? String(opt.description) : undefined, emoji: opt.emoji };
    });
    normalized.minValues = field.minValues != null ? Number(field.minValues) : (normalized.required ? 1 : 0);
    normalized.maxValues = field.maxValues != null ? Number(field.maxValues) : 1;
    normalized.placeholder = field.placeholder ? String(field.placeholder) : undefined;
  }

  if (['user_select', 'role_select', 'channel_select', 'mentionable_select'].includes(type)) {
    normalized.placeholder = field.placeholder ? String(field.placeholder) : undefined;
  }

  return normalized;
}

function isValidUrl(value) {
  if (!value) return false;
  return /^https?:\/\//i.test(value);
}

function configInfoEmbed(slug, config) {
  const fieldsText = config.fields
    .map((f, i) => {
      const type = f.type || f.style || 'short';
      return `${i + 1}. \`${f.id}\` — ${f.label || f.content || ''} (${type}${f.required ? ', obrigatório' : ''})`;
    })
    .join('\n') || 'Nenhum campo configurado.';

  const postable = isEventPostable(config) ? 'Sim' : 'Não';
  const linkText = config.linkButton
    ? `[${config.linkButton.label}](${config.linkButton.url})`
    : 'nenhum';

  return new EmbedBuilder()
    .setTitle(`Config do evento: ${config.title || slug}`)
    .setDescription(config.description || 'Sem descrição.')
    .setColor(parseHexColor(config.color) || 0x00b894)
    .addFields(
      { name: 'Slug', value: slug, inline: true },
      { name: 'Pronto para postar', value: postable, inline: true },
      { name: 'Cor', value: config.color || 'padrão', inline: true },
      { name: 'Imagem', value: config.image || 'nenhuma', inline: true },
      { name: 'Link extra', value: linkText, inline: true },
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
      .addStringOption(opt => opt.setName('nome').setDescription('Nome curto do evento').setRequired(true).setAutocomplete(true))
      .addStringOption(opt => opt.setName('titulo').setDescription('Título do evento').setRequired(true))
      .addStringOption(opt => opt.setName('descricao').setDescription('Descrição curta do evento').setRequired(true))
      .addStringOption(opt => opt.setName('cor').setDescription('Cor do embed em hex, ex: #00b894'))
      .addStringOption(opt => opt.setName('imagem').setDescription('URL de uma imagem grande para o embed'))
      .addStringOption(opt => opt.setName('link_label').setDescription('Texto do botão de link extra (opcional)'))
      .addStringOption(opt => opt.setName('link_url').setDescription('URL do botão de link extra (use "remover" para limpar)'))
      .addStringOption(opt => opt.setName('campos').setDescription('Array JSON dos campos do modal (opcional — pode usar /eventconfig campo adicionar depois)')))

    .addSubcommand(sub => sub
      .setName('deletar')
      .setDescription('Deleta um evento e suas inscrições')
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do evento').setRequired(true).setAutocomplete(true)))

    .addSubcommand(sub => sub
      .setName('editar')
      .setDescription('Edita nome, descrição, cor, imagem ou botão de link do evento')
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do evento').setRequired(true).setAutocomplete(true))
      .addStringOption(opt => opt.setName('titulo').setDescription('Novo título'))
      .addStringOption(opt => opt.setName('descricao').setDescription('Nova descrição'))
      .addStringOption(opt => opt.setName('cor').setDescription('Nova cor em hex, ex: #ff0000'))
      .addStringOption(opt => opt.setName('imagem').setDescription('Nova URL de imagem (use "remover" para limpar)'))
      .addStringOption(opt => opt.setName('link_label').setDescription('Texto do botão de link (use "remover" para limpar)'))
      .addStringOption(opt => opt.setName('link_url').setDescription('URL do botão de link (use "remover" para limpar)')))

    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('Mostra a configuração atual do evento')
      .addStringOption(opt => opt.setName('nome').setDescription('Nome do evento').setRequired(true).setAutocomplete(true)))

    .addSubcommandGroup(group => group
      .setName('campo')
      .setDescription('Gerencia campos do evento')

      .addSubcommand(sub => sub
        .setName('adicionar')
        .setDescription('Adiciona um campo ao modal de inscrição')
        .addStringOption(opt => opt.setName('nome').setDescription('Nome do evento').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('id').setDescription('ID interno do campo (ex: minecraft)').setRequired(true))
        .addStringOption(opt => opt.setName('label').setDescription('Texto do campo no modal').setRequired(true))
        .addStringOption(opt => opt.setName('tipo').setDescription('Tipo de campo no modal').setRequired(true)
          .addChoices(
            { name: 'Texto curto', value: 'short' },
            { name: 'Texto longo', value: 'paragraph' },
            { name: 'Texto exibição', value: 'text_display' },
            { name: 'Seleção de opções', value: 'string_select' },
            { name: 'Seleção de usuário', value: 'user_select' },
            { name: 'Seleção de cargo', value: 'role_select' },
            { name: 'Seleção de canal', value: 'channel_select' },
            { name: 'Seleção de mencionáveis', value: 'mentionable_select' }
          ))
        .addStringOption(opt => opt.setName('conteudo').setDescription('Texto exibido (apenas text_display)').setRequired(false))
        .addStringOption(opt => opt.setName('opcoes').setDescription('Opções da seleção em JSON (apenas string_select)').setRequired(false))
        .addStringOption(opt => opt.setName('placeholder').setDescription('Placeholder da seleção').setRequired(false))
        .addIntegerOption(opt => opt.setName('minvalues').setDescription('Mínimo de opções selecionáveis').setRequired(false))
        .addIntegerOption(opt => opt.setName('maxvalues').setDescription('Máximo de opções selecionáveis').setRequired(false))
        .addBooleanOption(opt => opt.setName('obrigatorio').setDescription('Se o campo é obrigatório').setRequired(false))
        .addIntegerOption(opt => opt.setName('maxlength').setDescription('Máximo de caracteres (apenas texto)').setRequired(false)))

      .addSubcommand(sub => sub
        .setName('remover')
        .setDescription('Remove um campo do modal de inscrição')
        .addStringOption(opt => opt.setName('nome').setDescription('Nome do evento').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('id').setDescription('ID do campo').setRequired(true)))

      .addSubcommand(sub => sub
        .setName('editar')
        .setDescription('Edita um campo existente')
        .addStringOption(opt => opt.setName('nome').setDescription('Nome do evento').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('id').setDescription('ID do campo').setRequired(true))
        .addStringOption(opt => opt.setName('label').setDescription('Novo texto do campo'))
        .addStringOption(opt => opt.setName('tipo').setDescription('Tipo de campo no modal')
          .addChoices(
            { name: 'Texto curto', value: 'short' },
            { name: 'Texto longo', value: 'paragraph' },
            { name: 'Texto exibição', value: 'text_display' },
            { name: 'Seleção de opções', value: 'string_select' },
            { name: 'Seleção de usuário', value: 'user_select' },
            { name: 'Seleção de cargo', value: 'role_select' },
            { name: 'Seleção de canal', value: 'channel_select' },
            { name: 'Seleção de mencionáveis', value: 'mentionable_select' }
          ))
        .addStringOption(opt => opt.setName('conteudo').setDescription('Texto exibido (apenas text_display)'))
        .addStringOption(opt => opt.setName('opcoes').setDescription('Opções da seleção em JSON (apenas string_select)'))
        .addStringOption(opt => opt.setName('placeholder').setDescription('Placeholder da seleção'))
        .addIntegerOption(opt => opt.setName('minvalues').setDescription('Mínimo de opções selecionáveis'))
        .addIntegerOption(opt => opt.setName('maxvalues').setDescription('Máximo de opções selecionáveis'))
        .addBooleanOption(opt => opt.setName('obrigatorio').setDescription('Se o campo é obrigatório'))
        .addIntegerOption(opt => opt.setName('maxlength').setDescription('Máximo de caracteres (apenas texto)')))),

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
      const linkLabel = interaction.options.getString('link_label');
      const linkUrl = interaction.options.getString('link_url');
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

      if (linkLabel && isValidUrl(linkUrl)) {
        config.linkButton = { label: linkLabel, url: linkUrl };
      }

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

      const linkLabel = interaction.options.getString('link_label');
      const linkUrl = interaction.options.getString('link_url');
      if (linkUrl === 'remover' || linkLabel === 'remover') {
        delete config.linkButton;
      } else if (isValidUrl(linkUrl) && linkLabel) {
        config.linkButton = { label: linkLabel, url: linkUrl };
      } else if (isValidUrl(linkUrl) && config.linkButton) {
        config.linkButton.url = linkUrl;
      } else if (linkLabel && config.linkButton) {
        config.linkButton.label = linkLabel;
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
        const tipoValue = interaction.options.getString('tipo', true);
        logger.info(`eventconfig campo adicionar: tipo raw = ${tipoValue}`);
        const newField = {
          id: fieldId,
          label: interaction.options.getString('label', true),
          type: tipoValue,
          content: interaction.options.getString('conteudo') || undefined,
          placeholder: interaction.options.getString('placeholder') || undefined,
          required: interaction.options.getBoolean('obrigatorio') !== false,
          maxLength: interaction.options.getInteger('maxlength') || 4000,
          minValues: interaction.options.getInteger('minvalues') ?? undefined,
          maxValues: interaction.options.getInteger('maxvalues') ?? undefined,
        };
        const optionsRaw = interaction.options.getString('opcoes');
        if (optionsRaw) {
          try {
            newField.options = JSON.parse(optionsRaw);
          } catch (e) {
            return interaction.reply({ content: 'Opções inválidas: o campo `opcoes` precisa ser um JSON válido.', flags: MessageFlags.Ephemeral });
          }
        }
        try {
          config.fields.push(normalizeField(newField, config.fields.length));
        } catch (e) {
          return interaction.reply({ content: `Erro no campo: ${e.message}`, flags: MessageFlags.Ephemeral });
        }
        logger.info(`eventconfig campo adicionar: saved field ${fieldId} as type ${config.fields[config.fields.length - 1].type}`);
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
        if (label !== null) field.label = label;
        const content = interaction.options.getString('conteudo');
        if (content !== null) field.content = content;
        const type = interaction.options.getString('tipo');
        if (type) {
          if (!VALID_FIELD_TYPES.includes(type)) {
            return interaction.reply({ content: `Tipo deve ser um de: ${VALID_FIELD_TYPES.join(', ')}.`, flags: MessageFlags.Ephemeral });
          }
          field.type = type;
          if (type === 'short' || type === 'paragraph') field.style = type;
        }
        const placeholder = interaction.options.getString('placeholder');
        if (placeholder !== null) field.placeholder = placeholder;
        const minValues = interaction.options.getInteger('minvalues');
        if (minValues !== null) field.minValues = minValues;
        const maxValues = interaction.options.getInteger('maxvalues');
        if (maxValues !== null) field.maxValues = maxValues;
        const required = interaction.options.getBoolean('obrigatorio');
        if (required !== null) {
          field.required = required;
          // Sync minValues for select types when required changes
          if (field.type === 'string_select' || ['user_select', 'role_select', 'channel_select', 'mentionable_select'].includes(field.type)) {
            if (minValues === null) { // only auto-set if user didn't explicitly set minValues
              field.minValues = required ? 1 : 0;
            }
          }
        }
        const maxLength = interaction.options.getInteger('maxlength');
        if (maxLength !== null) field.maxLength = maxLength;
        const optionsRaw = interaction.options.getString('opcoes');
        if (optionsRaw) {
          try {
            field.options = JSON.parse(optionsRaw);
          } catch (e) {
            return interaction.reply({ content: 'Opções inválidas: o campo `opcoes` precisa ser um JSON válido.', flags: MessageFlags.Ephemeral });
          }
        }
        saveEventConfig(slug, config);
        const updatedCount = await updatePostedMessages(interaction.client, slug, config);
        const syncText = updatedCount > 0 ? ` ${updatedCount} mensagem(ns) postada(s) atualizada(s).` : '';
        return interaction.reply({ content: `Campo \`${fieldId}\` atualizado.${syncText}`, embeds: [configInfoEmbed(slug, config)], flags: MessageFlags.Ephemeral });
      }
    }

    return interaction.reply({ content: 'Subcomando não reconhecido.', flags: MessageFlags.Ephemeral });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'nome') return;
    const slugs = listEventSlugs();
    const filtered = slugs.filter(s => s.toLowerCase().includes(focused.value.toLowerCase()));
    await interaction.respond(filtered.map(slug => ({ name: slug, value: slug })).slice(0, 25));
  },
};
