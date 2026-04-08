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
  { q: 'O primeiro sub 20 em uma run solo foi na Versao 1.16.1 pelo Sizzler', options: ['Verdade', 'Falso'], correctIndex: 0 },
  { q: 'Na Categoria Pre 1.9, quem foi o Primeiro Sub 20?', options: ['M4xx', 'WhateverMarco', 'Infume', 'DoyPingu'], correctIndex: 2 },
  { q: 'Depois do sub 20 do sizzler na 1.16, Qual foi a proxima versao, e por qual runner, a bater a barreira dos 20 minutos?', options: ['Infume - 1.8', 'WhateverMarco - 1.7', 'Dimeax - 1.14', 'Korbanoes - 1.15'], correctIndex: 2 },
  { q: 'Qual dessas alternativas eh uma estrategia usada em diversas runs de alto nivel e WRs de 1.15?', options: ['Clay', 'Insomniac', 'Classic', 'Tower'], correctIndex: 1 },
  { q: 'QUantos Strongholds existem no SEGUNDO Ring de strongholds?', options: ['9', '4', '6', '8'], correctIndex: 2 },
  { q: 'Bastions nao podem Spawnar em biomas de basalto, e por causa disso, basaltos tem muito mais Fortresses. Verdadeiro ou Falso?', options: ['Verdade', 'Falso'], correctIndex: 1 },
  { q: 'Em qual versao Piglin Brutes foram adicionados?', options: ['1.16.2', '1.17', '1.16.5', '1.18'], correctIndex: 0 },
  { q: 'Tem uma pequena chance de piglins dançarem com seus braços para cima depois de derrotar um hoglin. Verdadeiro ou Falso?', options: ['Verdade', 'Falso'], correctIndex: 0 },
  { q: 'Contando Todos os blocos possiveis, quantos blocos de ouro tem um Treasure?', options: ['24', '43', '35', '47'], correctIndex: 2 },
  { q: 'Contando Todos os blocos possiveis, quantos blocos de ouro tem um Housing?', options: ['20', '43', '35', '47'], correctIndex: 0 },
  { q: 'Em Qual dessas versoes speedruns RSG Peaceful podem ser feitas?', options: ['1.3.0', '1.9.1', '1.12.2', '1.8.9'], correctIndex: 3 },
  { q: 'Qual dessas categorias NAO existe no speedrun.com?', options: ['Obtain Player Head', 'Sonic Tail And Knuckles', 'Faz o L (Build an L%)', 'Beaconator'], correctIndex: 3 },
  { q: 'Como chegar no pie chart pro mapless?', options: ['gameRenderer -> level -> tick -> blockEntities', 'gameRenderer -> tick -> blockEntities', 'gameRenderer -> entities -> blockEntities', 'gameRenderer -> level -> entities'], correctIndex: 3 },
  { q: 'Quem ganhou a primeira playoffs?', options: ['Lowkey', 'Dandannyboy', 'Doogile', 'Silverruns'], correctIndex: 3 },
  { q: 'Quantos tipos de shipwreck existem?', options: ['8', '16', '11', '4'], correctIndex: 2 },
  { q: 'Qual tipo de Bastion tem a variacao com a menor quantidade de ouro entre todas os bastions?', options: ['Housing', 'Stables', 'Bridge', 'Treasure'], correctIndex: 1 },




];

module.exports = { QUESTIONS };
