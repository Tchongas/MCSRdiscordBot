// Central place to manage /daily quiz questions.
// Each entry: { q: string, options: string[], correctIndex: number }

const QUESTIONS = [
  { q: 'De quem foi a primeira run brasileira de 1.16 rsg?', options: ['DaviMD', 'GeovaTheLegend', 'Thomas', 'Bishop'], correctIndex: 1 },
  { q: 'Quantas abelhas estao na sua porta?', options: ['100', '10 mil', '100 mil', 'mil'], correctIndex: 1 },
  { q: 'Quem teve o RB que durou mais tempo?', options: ['Brahma', 'Spectro', 'Shy', 'Pedrodbr'], correctIndex: 2 },
  { q: 'Qual Runner xitou em um SMP usando kill aura?', options: ['Asky', 'Batato', 'Ferrer', 'Epik'], correctIndex: 3 },
  { q: 'Quem foi o primeiro sub 9 do Brasil?', options: ['Reiper', 'Misfit', 'Brahma', 'Epik'], correctIndex: 0 },
  { q: 'Quem eh o melhor mod:)?', options: ['Xande', 'Thomas', 'Manu', 'Ferrer'], correctIndex: 1 },
  { q: 'Quem foi o primeiro sub 2 em SSG do brasil?', options: ['Shy', 'Thig', 'Xheb', 'Bepeze'], correctIndex: 2 },
  { q: 'Quantos Strongholds existem em um mundo na 1.16?', options: ['64', '3', '128', '256'], correctIndex: 2 },
  { q: 'Qual bastion tem um bau com uma lodestone?', options: ['Housing', 'Stables', 'Bridge', 'Treasure'], correctIndex: 2 },
  { q: 'Oque o R de MCSR significa?', options: ['Rodolfo', 'Renato', 'Ranked', 'Run'], correctIndex: 3 },
  { q: 'Quantos pilares de obsidian existem no end?', options: ['14', '12', '10', '8'], correctIndex: 2 },
  { q: 'Qual Bastion tem spawners?', options: ['Housing', 'Stables', 'Bridge', 'Treasure'], correctIndex: 3 },
  { q: 'Qual desses nomes NAO foi o nome de um runner?', options: ['lazaro_gamer', 'JOAOMINUSCULO', 'DoutorEneas', 'Bostalover'], correctIndex: 3 },
  { q: 'Qual bastion tem Fungo do nether naturalmente?', options: ['Housing', 'Stables', 'Bridge', 'Treasure'], correctIndex: 0 },
  { q: 'Quem pegou o primeiro sub 10 do mundo?', options: ['Cube1337x', 'Sizzler', 'Brentilda', 'doogile'], correctIndex: 2 },
  { q: 'O dragao lentamente desce ate a fonte durante o perch, dando voltas ate chegar no chao, em qual versao isso foi adicionado?', options: ['1.9', '1.14', '1.13.2', '1.12.2'], correctIndex: 1 },
  { q: 'Qual runner ganhou 1000 reais de premio apos conseguir um novo recorde brasileiro em RSG?', options: ['Batato', 'Brahma', 'Booster', 'doogile'], correctIndex: 2 },
  { q: 'Qual desses runners NAO xitou uma run?', options: ['Epik', 'Tchongass', 'Asky', 'Xande'], correctIndex: 0 },
];

module.exports = { QUESTIONS };
