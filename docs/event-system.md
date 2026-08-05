# Sistema de Inscrição em Eventos
---

## Comandos disponíveis

- **`/eventconfig criar`** — Cria um novo evento. Precisa de nome, título e descrição. Campos e imagem são opcionais.
- **`/eventconfig editar`** — Edita um evento existente (título, descrição, cor, imagem, botão de link).
- **`/eventconfig info`** — Mostra a configuração atual de um evento e seus campos.
- **`/eventconfig deletar`** — Deleta um evento e todas as inscrições.
- **`/eventconfig campo adicionar`** — Adiciona uma pergunta ao formulário de inscrição.
- **`/eventconfig campo editar`** — Edita uma pergunta existente.
- **`/eventconfig campo remover`** — Remove uma pergunta do formulário.
- **`/evento`** — Posta o embed do evento no canal com o botão de inscrição.
- **`/eventolimpar`** — Deleta todos os embeds postados de um evento.

---

## Como usar (passo a passo)

### Passo 1 — Criar o evento

Use o comando `/eventconfig criar`. Você precisa de um **nome** (identificador interno, algo como torneio1), um **título** (que aparece no embed, da pra usar emoji) e uma **descrição**. o **Campos** são opcionais, pode adicionar depois

```txt
/eventconfig criar nome:torneio_verao titulo:🏆 Torneio de Verão descricao:Inscreva-se no torneio! cor:#00b894
```

### Passo 2 — Adicionar campos (perguntas) ao formulário

Cada pergunta do formulário é um "campo". Você pode adicionar campos um por um com `/eventconfig campo adicionar`, ou já passar todos de uma vez no `campos` do `/eventconfig criar`.

#### Opção A: Adicionar campos um por um

```txt
/eventconfig campo adicionar nome:torneio_verao id:nick label:Seu nick no Minecraft tipo:Texto curto
/eventconfig campo adicionar nome:torneio_verao id:modalidade label:Modalidade tipo:Seleção de opções opcoes:[{"label":"Solo","value":"solo"},{"label":"Duo","value":"duo"}]
```

#### Opção B: Passar todos os campos de uma vez na criação

```txt
/eventconfig criar nome:torneio_verao titulo:🏆 Torneio descricao:Inscreva-se! campos:[{"id":"nick","label":"Seu nick","type":"short"},{"id":"modalidade","label":"Modalidade","type":"string_select","required":true,"options":[{"label":"Solo","value":"solo"},{"label":"Duo","value":"duo"}]}]
```

### Passo 3 — Postar o evento no canal

```txt
/evento nome:torneio_verao
```

Essa mensagem atualiza automaticamente caso voce mude algo no evento, como título, descrição, cor, etc.

O bot posta o embed com o botão **INSCREVA-SE**. Os usuários clicam, preenchem o formulário e ficam salvos.

### Passo 4 (opcional) — Adicionar botão de link

Se quiser, pode colocar um botão azul de link ao lado do **INSCREVA-SE**. Serve para linkar regras, formulário externo, ou qualquer página. É totalmente opcional.

```txt
/eventconfig editar nome:torneio_verao link_label:Regras do torneio link_url:https://example.com/regras
```

Isso adiciona um botão azul com o texto "Regras do torneio" que abre o link quando clicado.

**Para remover o botão depois:**

```txt
/eventconfig editar nome:torneio_verao link_label:remover
```

> **Dica:** Você também pode já definir o botão na criação do evento:
> ```txt
> /eventconfig criar nome:torneio titulo:Torneio descricao:... link_label:Regras link_url:https://example.com
> ```

---

## Exemplos de JSON para `campos` e `opcoes`

### JSON de campos (parâmetro `campos`)

O parâmetro `campos` aceita um **array JSON** (lista entre colchetes). Cada item é um objeto com as propriedades do campo.

**Exemplo simples — só texto:**

```json
[
  {"id": "nick", "label": "Seu nick no Minecraft", "type": "short", "required": true},
  {"id": "sobre", "label": "Fale sobre você", "type": "paragraph", "required": false}
]
```

**Exemplo com seleção de opções:**

```json
[
  {"id": "nick", "label": "Seu nick", "type": "short", "required": true},
  {"id": "modalidade", "label": "Modalidade", "type": "string_select", "required": true, "options": [{"label": "Solo", "value": "solo"}, {"label": "Duo", "value": "duo"}, {"label": "Trio", "value": "trio"}]},
  {"id": "voluntario", "label": "Quer ajudar?", "type": "string_select", "required": false, "options": [{"label": "Referee", "value": "referee"}, {"label": "Narrador", "value": "narrador"}, {"label": "Host", "value": "host"}], "maxValues": 3}
]
```

### JSON de opções (parâmetro `opcoes`)

Quando você usa `/eventconfig campo adicionar` com tipo `Seleção de opções`, precisa passar o parâmetro `opcoes` como JSON. É uma lista de objetos, cada um com `label` (o que o usuário vê) e `value` (o que é salvo internamente).

**Exemplo básico:**

```json
[{"label": "Solo", "value": "solo"}, {"label": "Duo", "value": "duo"}]
```

**Exemplo com mais opções:**

```json
[{"label": "Referee", "value": "referee"}, {"label": "Seedfinder/Seedtester", "value": "seedfinder"}, {"label": "Narrador/Comentarista", "value": "narrador"}, {"label": "Host/Operador de live", "value": "host"}]
```

> **IMPORTANTE:** O JSON precisa estar **exatamente** nesse formato. Aspas duplas `"`, colchetes `[]`, chaves `{}`. Se errar algum caractere o bot vai dar erro.

---

## Tipos de campo disponíveis

Quando adicionar um campo, o `tipo` define o que aparece no formulário:

| Tipo no comando | Valor interno | O que faz |
|-----------------|---------------|-----------|
| Texto curto | `short` | Campo de texto de uma linha |
| Texto longo | `paragraph` | Campo de texto grande (várias linhas) |
| Seleção de opções | `string_select` | Menu dropdown com opções definidas por você |
| Seleção de usuários | `user_select` | Menu para selecionar membros do servidor |
| Seleção de cargos | `role_select` | Menu para selecionar cargos |
| Seleção de canais | `channel_select` | Menu para selecionar canais |
| Seleção de mencionáveis | `mentionable_select` | Menu para selecionar usuários ou cargos |
| Exibição de texto | `text_display` | Mostra um texto estático (sem input) |

---

## Comandos

### `/eventconfig`

Apenas administradores.

| Subcomando | O que faz |
|------------|-----------|
| `criar` | Cria um novo evento. |
| `editar` | Edita título, descrição, cor, imagem ou botão de link. |
| `info` | Mostra a configuração atual e os campos. |
| `deletar` | Remove o evento e todas as inscrições. |
| `campo adicionar` | Adiciona uma pergunta ao formulário. |
| `campo remover` | Remove uma pergunta do formulário. |
| `campo editar` | Edita uma pergunta existente. |

Todos os campos `nome` suportam autocomplete — comece a digitar e o Discord mostra os eventos existentes.

### `/evento`

Posta o embed do evento no canal. Apenas admins e o usuário autorizado podem usar.

### `/eventolimpar`

Deleta todos os embeds postados de um evento e para de rastrear os IDs. Mesmas permissões do `/evento`.

---

## Adicionar ou trocar imagem

O embed do evento suporta uma imagem grande via a opção `imagem`.

**Na criação:**

```txt
/eventconfig criar nome:torneio_verao titulo:🏆 Torneio descricao:... imagem:https://i.imgur.com/exemplo.png
```

**Depois de criar:**

```txt
/eventconfig editar nome:torneio_verao imagem:https://i.imgur.com/novaimagem.png
```

**Para remover:**

```txt
/eventconfig editar nome:torneio_verao imagem:remover
```

Regras:
- Precisa ser uma URL direta de imagem (o Discord vai renderizar).
- O bot **não** faz upload de arquivo — só aceita URLs.
- Mensagens já postadas são atualizadas automaticamente.

---

## Adicionar botão de link

Você pode colocar um botão azul de link ao lado do **INSCREVA-SE**.

```txt
/eventconfig editar nome:torneio_verao link_label:Regras do torneio link_url:https://example.com/regras
```

Para remover:

```txt
/eventconfig editar nome:torneio_verao link_label:remover
```

---

## Configuração de campos

Cada campo do formulário tem estas propriedades:

| Propriedade | Obrigatório | Tipo | Descrição |
|-------------|-------------|------|-----------|
| `id` | Sim | string | ID interno. Só letras minúsculas, números e `_`. Ex: `nick`, `modalidade`. |
| `label` | Sim | string | Texto que aparece acima do campo no formulário. |
| `type` | Sim | string | Tipo do campo: `short`, `paragraph`, `string_select`, etc. |
| `options` | Para selects | array | Lista de opções. Cada opção precisa de `label` e `value`. |
| `placeholder` | Não | string | Texto cinza que aparece quando o campo está vazio. |
| `minValues` | Não | number | Mínimo de opções selecionáveis. Padrão: 1 (ou 0 se não obrigatório). |
| `maxValues` | Não | number | Máximo de opções selecionáveis. Padrão: 1. |
| `required` | Não | boolean | Se o usuário precisa preencher. Padrão: `true`. |
| `maxLength` | Não | number | Máximo de caracteres (para campos de texto). Padrão: `4000`. |

### Exemplo de `config.json`

Salvo em `data/events/<slug>/config.json`:

```json
{
  "title": "🏆 Torneio de Verão",
  "description": "Inscreva-se no torneio de PvP do servidor!",
  "color": "#00b894",
  "image": "https://i.imgur.com/example.png",
  "modalTitle": "Inscrição: 🏆 Torneio de Verão",
  "fields": [
    {
      "id": "nick",
      "label": "Seu nick no Minecraft",
      "type": "short",
      "required": true,
      "maxLength": 32
    },
    {
      "id": "modalidade",
      "label": "Modalidade",
      "type": "string_select",
      "required": true,
      "options": [
        { "label": "Solo", "value": "solo" },
        { "label": "Duo", "value": "duo" }
      ],
      "minValues": 1,
      "maxValues": 1
    },
    {
      "id": "voluntario",
      "label": "Gostaria de nos ajudar?",
      "type": "string_select",
      "required": false,
      "options": [
        { "label": "Referee", "value": "referee" },
        { "label": "Narrador", "value": "narrador" },
        { "label": "Host", "value": "host" }
      ],
      "minValues": 0,
      "maxValues": 3
    },
    {
      "id": "experiencia",
      "label": "Experiência com speedrun",
      "type": "paragraph",
      "required": false,
      "maxLength": 500
    }
  ]
}
```

---

## Fluxo de inscrição (como funciona)

1. Admin posta o evento com `/evento`.
2. O bot salva o ID da mensagem para atualizações.
3. Usuário clica em **INSCREVA-SE**.
4. Um formulário (modal) abre com todos os campos configurados.
5. Usuário preenche e envia. Os dados são salvos em `data/events/<slug>/signups.json`.
6. O bot envia uma confirmação privada.
7. Se o admin editar o evento, todas as mensagens postadas são atualizadas automaticamente.

---

## Sincronização externa

As inscrições são sempre salvas localmente primeiro. Se configurar um endpoint externo, cada inscrição (e cancelamento) também é enviada de forma assíncrona.

Variáveis de ambiente:

| Variável | Função |
|----------|--------|
| `EXTERNAL_SIGNUP_ENDPOINT` | URL para enviar as inscrições via POST. Se não definida, a sync está desabilitada. |
| `EXTERNAL_SIGNUP_TOKEN` | Token bearer opcional, enviado como `Authorization: Bearer <token>`. |

Payload enviado:

```json
{
  "type": "upsert",
  "slug": "torneio_verao",
  "userId": "123456789",
  "displayName": "PlayerName",
  "values": { "nick": "Steve", "modalidade": "solo" },
  "sentAt": "2026-08-03T19:51:38.000Z"
}
```

Para cancelamentos, `type` é `"delete"` e `values` é vazio. Envios que falharem são reenviados com backoff exponencial (começa em 30s, máximo 1h) e ficam salvos em `data/external-signup-queue.json` entre restarts. O fluxo principal nunca é bloqueado pela sync externa.

---

## Limitações

### Limite de campos por modal

- Máximo de **5 campos** por formulário.
- Cada label pode ter até 45 caracteres.
- Cada input de texto suporta até 4.000 caracteres (configurável via `maxLength`).

### Componentes suportados

- ✅ Texto curto (uma linha)
- ✅ Texto longo (parágrafo)
- ✅ Dropdown de opções (seleção única ou múltipla)
- ✅ Seleção de usuários/cargos/canais
- ✅ Texto estático (exibição de texto)
- ❌ Botões dentro do modal
- ❌ Upload de arquivos
- ❌ Imagens ou embeds dentro do modal

### Atualização de mensagens postadas

Editar a configuração atualiza todas as mensagens rastreadas. Se uma mensagem foi deletada ou o bot perdeu permissão, ela é removida do rastreamento. Para "resincronizar", basta postar o evento novamente com `/evento`.

---

## Arquivos

| Arquivo | Função |
|---------|--------|
| `data/events/<slug>/config.json` | Configuração do evento e campos. |
| `data/events/<slug>/signups.json` | Inscrições dos usuários. |
| `data/events/<slug>/messages.json` | IDs das mensagens postadas (para atualização automática). |

---

## Observações

- O slug do evento é gerado a partir do `nome`: letras minúsculas, sem acentos, espaços viram hífens, máximo 40 caracteres.
- O embed público **não** mostra a lista de participantes. Apenas admins podem ler os dados de inscrição no arquivo JSON.
- Se dois usuários se inscreverem ao mesmo tempo, o sistema usa um lock interno para evitar perda de dados.
