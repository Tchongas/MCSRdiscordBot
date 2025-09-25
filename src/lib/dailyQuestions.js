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
  { q: 'Oque o R de MCSR significa?', options: ['Running', 'Renato', 'Ranked', 'Run'], correctIndex: 0 },
];

module.exports = { QUESTIONS };
