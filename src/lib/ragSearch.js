const fs = require('fs');
const path = require('path');
const { findRunnerNamesInText, getRunnerLiveContext, loadProfileCache, isProfileCacheLoaded } = require('./profile');

const DEFAULT_FILES = 'src/data/rag/**/*.md';
const DEFAULT_MAX_CHARS = 2000;
const DEFAULT_MAX_BLOCKS = 3;
const BLOCK_DELIMITER = /^---+\s*$/gm;
const DEFAULT_KEYWORDS_FILE = 'src/data/rag/keywords.json';

const STOPWORDS = new Set([
  // português
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'pra', 'pro', 'pros', 'pras', 'com',
  'sem', 'sob', 'sobre', 'entre', 'durante', 'antes', 'depois', 'apos', 'ate', 'desde',
  'quando', 'onde', 'como', 'qual', 'quais', 'quem', 'que', 'porque', 'porquê', 'mas',
  'e', 'ou', 'se', 'nao', 'sim', 'ja', 'ainda', 'tambem', 'so', 'todo', 'todos', 'cada',
  'muito', 'mais', 'menos', 'bem', 'mal', 'aqui', 'ai', 'ali', 'la', 'ca', 'assim',
  'entao', 'agora', 'hoje', 'ontem', 'amanha', 'nunca', 'sempre', 'talvez', 'mesmo',
  'outro', 'outra', 'outros', 'outras', 'algum', 'alguma', 'alguns', 'algumas',
  'nenhum', 'nenhuma', 'qualquer', 'esse', 'essa', 'esses', 'essas', 'aquele',
  'aquela', 'aqueles', 'aquelas', 'isto', 'isso', 'aquilo', 'ne', 'nem', 'pra',
  // english
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me',
  'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'what', 'which',
  'who', 'where', 'when', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'now', 'then', 'here', 'there',
]);

function getFilePatterns() {
  const raw = process.env.DARKGPT_RAG_FILES || DEFAULT_FILES;
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function resolvePattern(baseDir, pattern) {
  const normalized = pattern.replace(/\\/g, '/');
  if (!normalized.includes('*')) {
    return [path.resolve(baseDir, normalized)];
  }

  const parts = normalized.split('/');
  const filePattern = parts.pop();
  const fileRegex = new RegExp(
    '^' + filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
  );

  const doubleStarIndex = parts.indexOf('**');
  if (doubleStarIndex !== -1) {
    const baseSubdir = parts.slice(0, doubleStarIndex).join('/');
    const root = path.resolve(baseDir, baseSubdir || '.');
    const results = [];

    function walk(dir) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && fileRegex.test(entry.name)) {
          results.push(fullPath);
        }
      }
    }

    walk(root);
    return results;
  }

  const dirPattern = parts.join('/');
  const dir = path.resolve(baseDir, dirPattern || '.');

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter(entry => fileRegex.test(entry))
    .map(entry => path.resolve(dir, entry));
}

function resolveFiles(baseDir, patterns = getFilePatterns()) {
  const files = new Set();
  for (const pattern of patterns) {
    for (const file of resolvePattern(baseDir, pattern)) {
      files.add(file);
    }
  }
  return Array.from(files);
}

function extractBlocks(content) {
  return content
    .split(BLOCK_DELIMITER)
    .map(block => block.trim())
    .filter(Boolean);
}

function loadAllBlocks(baseDir) {
  const blocks = [];
  for (const file of resolveFiles(baseDir)) {
    try {
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
      const content = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(baseDir, file).replace(/\\/g, '/');
      extractBlocks(content).forEach((block, index) => {
        blocks.push({ source: relPath, index, block });
      });
    } catch {
      // ignore unreadable files
    }
  }
  return blocks;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/gu)
    .filter(w => w.length >= 2 && !STOPWORDS.has(w));
}

function loadKeywordDictionary(baseDir) {
  const dictPath = path.resolve(baseDir, process.env.DARKGPT_RAG_KEYWORDS_FILE || DEFAULT_KEYWORDS_FILE);
  try {
    const raw = fs.readFileSync(dictPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normalizeDictionaryEntry(baseDir, entry) {
  const normalized = entry.replace(/\\/g, '/');
  if (normalized.includes('/')) {
    return path.relative(baseDir, path.resolve(baseDir, normalized)).replace(/\\/g, '/');
  }
  return `src/data/rag/${normalized}`;
}

function findTriggeredFiles(prompt, name, dictionary, baseDir) {
  const files = new Set();
  if (!dictionary) return files;

  const lowerPrompt = prompt ? prompt.toLowerCase() : '';
  const lowerName = name ? name.trim().toLowerCase() : '';

  for (const [keyword, fileList] of Object.entries(dictionary)) {
    const keywordParts = keyword
      .split(/[,|.]+/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    let match = false;
    for (const part of keywordParts) {
      if (part.startsWith('sender:')) {
        const senderKey = part.slice('sender:'.length).trim();
        if (lowerName && lowerName === senderKey) {
          match = true;
          break;
        }
      } else if (lowerPrompt && lowerPrompt.includes(part)) {
        match = true;
        break;
      }
    }

    if (!match) continue;
    const targets = Array.isArray(fileList) ? fileList : [fileList];
    for (const target of targets) {
      files.add(normalizeDictionaryEntry(baseDir, target));
    }
  }
  return files;
}

function scoreAndRank(blocks, name, prompt, keywordFiles) {
  const promptTokens = new Set(tokenize(prompt || ''));
  const nameLower = name ? name.toLowerCase() : '';

  const scored = blocks.map(item => {
    let score = 0;

    if (keywordFiles.has(item.source)) {
      score += 20;
    }

    if (nameLower && item.block.toLowerCase().includes(nameLower)) {
      score += 10;
    }

    const blockTokens = new Set(tokenize(item.block));
    for (const token of promptTokens) {
      if (blockTokens.has(token)) score += 1;
    }

    return { ...item, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  return scored;
}

async function buildLiveSections(name, prompt) {
  try {
    if (!isProfileCacheLoaded()) {
      await loadProfileCache();
    }

    const text = `${name || ''} ${prompt || ''}`;
    const names = new Set(findRunnerNamesInText(text));

    const seen = new Set();
    const sections = [];
    for (const runnerName of names) {
      const result = await getRunnerLiveContext(runnerName);
      if (!result || !result.context) continue;
      if (seen.has(result.name)) continue;
      seen.add(result.name);
      sections.push(`[live:${result.name}]\n${result.context}`);
    }
    return sections;
  } catch {
    return [];
  }
}

async function findMentions(name, prompt, baseDir = path.resolve(__dirname, '..', '..')) {
  if (!name && !prompt) return '';

  const maxChars = Number(process.env.DARKGPT_RAG_MAX_CHARS) || DEFAULT_MAX_CHARS;
  const maxBlocks = Number(process.env.DARKGPT_RAG_MAX_BLOCKS) || DEFAULT_MAX_BLOCKS;
  const separator = '\n\n';

  const liveSections = await buildLiveSections(name, prompt);
  let used = liveSections.reduce((sum, s, i) => sum + s.length + (i > 0 ? separator.length : 0), 0);

  const allBlocks = loadAllBlocks(baseDir);
  const keywordFiles = findTriggeredFiles(prompt, name, loadKeywordDictionary(baseDir), baseDir);
  const ranked = scoreAndRank(allBlocks, name, prompt, keywordFiles);

  const sections = [...liveSections];

  for (const item of ranked) {
    if (sections.length >= maxBlocks) break;
    if (item.score <= 0) continue;
    const section = `[${item.source}]\n${item.block}`;
    const addLen = separator.length + section.length;

    if (used + addLen > maxChars) {
      if (sections.length === liveSections.length) {
        const remaining = maxChars - used - separator.length;
        if (remaining > 10) {
          sections.push(section.slice(0, remaining) + '…');
        }
      }
      break;
    }

    sections.push(section);
    used += addLen;
  }

  return sections.join(separator);
}

module.exports = { findMentions };
