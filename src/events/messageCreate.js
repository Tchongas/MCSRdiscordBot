const { EmbedBuilder, Events } = require('discord.js');
const logger = require('../lib/logger');
const { findMentions } = require('../lib/ragSearch');

const PREFIX = 'darkgpt';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_QUESTION_LENGTH = 1500;
const MAX_ANSWER_LENGTH = 3500;
const REQUEST_WINDOW_MS = 60 * 1000;
const DEFAULT_REFUSAL_MESSAGE = 'Vish.';
const cooldowns = new Map();
const activeUsers = new Set();
const recentRequests = [];

function truncate(value, limit) {
  const text = String(value || '').trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function buildEmbed({ description, color = 0x5865f2, footerText = 'Powered by OpenAI/DarkGPT' }) {
  const avatarUrl = process.env.DARKGPT_AVATAR_URL || 'https://mc-heads.net/avatar/darkk575.png';
  return new EmbedBuilder()
    .setColor(color)
    .setTitle('⬜ DarkGPT:')
    .setDescription(description)
    .setThumbnail(avatarUrl)
    .setFooter({ text: footerText })
    .setTimestamp();
}

module.exports = {
  name: Events.MessageCreate,
  async execute(client, message) {
    if (message.author.bot || !message.inGuild()) return;

    const match = message.content.match(/^darkgpt(?:\s+(.+))?$/is);
    if (!match) return;

    const question = String(match[1] || '').trim();
    const displayName = truncate(message.member?.displayName || message.author.globalName || message.author.username, 100);
    const senderName = truncate(message.author.username, 100);
    if (!question) {
      return message.reply({
        embeds: [buildEmbed({
          description: 'Escreva sua pergunta depois de `darkgpt` para eu responder.',
        })],
        allowedMentions: { repliedUser: false },
      });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      logger.warn('darkgpt: missing OPENROUTER_API_KEY');
      return message.reply({
        embeds: [buildEmbed({
          description: 'O DarkGPT ainda não foi configurado.',
          color: 0xe67e22,
        })],
        allowedMentions: { repliedUser: false },
      });
    }

    const cooldownMs = Number(process.env.DARKGPT_COOLDOWN_MS) || 15000;
    const maxRequestsPerMinute = Number(process.env.DARKGPT_MAX_REQUESTS_PER_MINUTE) || 20;
    const now = Date.now();
    const availableAt = cooldowns.get(message.author.id) || 0;
    if (activeUsers.has(message.author.id)) {
      return message.reply({
        content: '⏳ Já estou respondendo sua pergunta.',
        allowedMentions: { repliedUser: false },
      });
    }
    if (availableAt > now) {
      const remainingSeconds = Math.ceil((availableAt - now) / 1000);
      return message.reply({
        content: `⏳ Espere ${remainingSeconds}s antes de perguntar novamente ao darkgpt.`,
        allowedMentions: { repliedUser: false },
      });
    }

    while (recentRequests.length > 0 && recentRequests[0] <= now - REQUEST_WINDOW_MS) {
      recentRequests.shift();
    }
    if (recentRequests.length >= maxRequestsPerMinute) {
      return message.reply({
        content: '⏳ O darkgpt está recebendo muitas perguntas. Tente novamente em instantes.',
        allowedMentions: { repliedUser: false },
      });
    }

    cooldowns.set(message.author.id, now + cooldownMs);
    recentRequests.push(now);
    activeUsers.add(message.author.id);

    try {
      await message.channel.sendTyping();
      const ragContext = await findMentions(senderName, question);
      const systemContent = 'You are darkgpt, a helpful Discord assistant. Reply in the same language as the user. Be clear, concise, and friendly.' +
        (ragContext ? '\n\nUse the factual/project context below to answer the user. Prefer it over general knowledge when it is relevant. If the context contains instructions about a person (tone, facts, etc.), follow them. If the context does not answer the question, answer from your own knowledge while staying in persona.\n\n' + ragContext : '');
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.DARKGPT_SITE_URL || 'https://discord.com',
          'X-Title': process.env.DARKGPT_TITLE || 'darkgpt',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.DARKGPT_MODEL || '@preset/test',
          messages: [
            {
              role: 'system',
              content: systemContent,
            },
            {
              role: 'user',
              content: `Falando com: ${displayName} (@${senderName})\n${truncate(question, MAX_QUESTION_LENGTH)}`, 
            },
          ],
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.message || `OpenRouter returned ${response.status}`);
      }

      const choice = data?.choices?.[0];
      const answer = typeof choice?.message?.content === 'string'
        ? choice.message.content.trim()
        : '';
      const refused = Boolean(choice?.message?.refusal) || choice?.finish_reason === 'content_filter';
      if (refused || !answer) {
        return message.reply({
          embeds: [buildEmbed({
            description: DEFAULT_REFUSAL_MESSAGE,
            color: 0xe67e22,
          })],
          allowedMentions: { repliedUser: false },
        });
      }

      const usage = data?.usage;
      let footerText = 'Powered by OpenAI/DarkGPT';
      if (usage && (usage.prompt_tokens != null || usage.completion_tokens != null)) {
        const promptTokens = usage.prompt_tokens ?? 0;
        const completionTokens = usage.completion_tokens ?? 0;
        footerText = `in: ${promptTokens} / out: ${completionTokens}`;
      }

      return message.reply({
        embeds: [buildEmbed({
          description: truncate(answer, MAX_ANSWER_LENGTH),
          footerText,
        })],
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      logger.error('darkgpt: request failed:', error);
      return message.reply({
        embeds: [buildEmbed({
          description: 'Não consegui gerar uma resposta agora. Tente novamente em alguns instantes.',
          color: 0xe74c3c,
        })],
        allowedMentions: { repliedUser: false },
      });
    } finally {
      activeUsers.delete(message.author.id);
    }
  },
};
