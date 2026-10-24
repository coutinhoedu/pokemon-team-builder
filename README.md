# Pokémon Team Builder

Dado um jogo e um pokémon base, monta um time de 6 com o menor número de fraquezas possível,
priorizando BST alto e desencorajando lendários, míticos, Ultra Beasts e Paradox. Depois sugere
4 golpes de dano para cada membro e dá notas de S a F para a defesa e o ataque do time.

## Stack

- **React + TypeScript** (com **Vite**) para a interface.
- **Node.js** para o script que baixa os dados da [PokeAPI](https://pokeapi.co/) uma única vez.
- **Vitest** para os testes.

Por que não um backend em Python/Node? O cálculo é leve (roda em menos de um segundo no
navegador) e os dados não mudam, então um backend só adicionaria complexidade. A PokeAPI também
pede que os dados sejam cacheados em vez de consultados a cada uso. Com tudo em TypeScript você
aprende React e Node usando uma linguagem só, e o site final é estático (dá para publicar de graça
no GitHub Pages, Netlify ou Vercel).

## Como rodar

Requer Node.js 18+ (`winget install OpenJS.NodeJS.LTS`).

```bash
npm install
npm run fetch-data   # baixa ~2.700 recursos da PokeAPI (alguns minutos na 1ª vez; depois usa o cache)
npm run dev          # abre em http://localhost:5173
npm test             # roda os testes
```

## Estrutura

```
scripts/fetch-data.mjs     baixa jogos, pokédexes, espécies, formas e golpes ->
                           public/data/pokedex.json e public/data/games/<jogo>.json (learnsets)
src/lib/typeChart.ts       tabela de tipos com as diferenças da Gen 1, Gens 2-5 e Gen 6+
src/lib/data.ts            carrega os JSONs e resolve tipos/atributos "como eram" na geração do jogo
src/lib/teamBuilder.ts     pontuação e busca do time
src/lib/abilities.ts       efeitos das habilidades (defesa, rating, ataque)
src/lib/movesets.ts        sugestão de golpes
src/lib/items.ts           sugestão de held items
src/lib/roles.ts           papel de cada pokémon e composições equilibradas
src/lib/coverage.ts        cobertura ofensiva e notas de S a F
src/components/            cards, badges de tipo, notas e tabelas de ataque/defesa
src/App.tsx                formulário e resultado
```

## Como o time é escolhido

1. **Candidatos**: todos os pokémon da dex do jogo (inclui formas regionais e alternativas que
   existem nele). Para cada combinação de tipos fica só o de maior BST; lendários perdem nessa
   disputa por causa da penalidade.
2. **Pontuação** (`WEIGHTS` em `teamBuilder.ts`), para cada tipo de ataque:
   - −1 por fraqueza de cada membro (4× conta como 2);
   - −1,5 × (fraquezas − resistências)², quando há mais fracos que resistentes (pune fraquezas empilhadas);
   - −2 se alguém é fraco e ninguém resiste;
   - +0,5 se pelo menos um membro resiste.
   Somam-se ainda +1,5 a cada 100 de BST, −6 por lendário/mítico e +0,4 por tipo que o time acerta
   super efetivo com STAB (a única noção ofensiva, já que movesets são ignorados).
3. **Busca**: testar todas as combinações seria inviável (centenas de candidatos, escolhendo 5),
   então uma *beam search* adiciona um membro por vez guardando os 300 melhores times parciais, e
   uma busca local tenta trocar membros enquanto a nota melhorar. As 3 melhores soluções aparecem
   como alternativas.
4. **Repetições de tipo** (0 a 6, padrão 0): cada vez que um tipo aparece de novo no time conta
   1 repetição (dois Água = 1; três Água = 2; dois Água e dois Voador = 2). Com 0, nenhum tipo se
   repete, incluindo os do base.

## Habilidades

- Cada habilidade possível de um pokémon vira um candidato separado; o builder escolhe a melhor
  para o time e a mostra destacada (★) no card. Habilidades existem a partir da Gen 3, e as
  ocultas a partir da Gen 5 (levemente penalizadas por serem mais difíceis de obter).
- Os efeitos ficam em `src/lib/abilities.ts` (`ABILITY_EFFECTS`):
  - **defensivos** mudam a tabela de tipos do pokémon (Levitate, Flash Fire, Thick Fat, Filter...);
  - **rating** soma ou subtrai "pontos de BST": Truant (−220), Slow Start (−200), Defeatist,
    Klutz, Stall... são desencorajados; Huge Power, Intimidate, Speed Boost... são valorizados;
  - **ofensivos** entram no cálculo dos golpes (Huge Power, Adaptability, Technician).
- Habilidades que não estão na tabela contam como neutras.

## Papéis e "Equilibrar atacantes"

Cada membro recebe um papel (`src/lib/roles.ts`), mostrado no card:

- **Tank**: a média de HP/Defesa/Defesa Especial supera o melhor atributo ofensivo em 5% ou mais;
- **Misto**: Ataque e Ataque Especial a menos de 15% um do outro;
- **Físico** ou **Especial**: o maior dos dois (Huge Power e afins contam no Ataque).

Com a opção "Equilibrar atacantes", o time precisa fechar numa composição do estilo escolhido
(`BALANCE_STYLES`):

| Estilo | Composição |
| --- | --- |
| Automático | qualquer uma abaixo ou 3 físicos + 3 especiais (fica a de melhor nota) |
| Ofensivo | 2 físicos + 2 especiais + 2 mistos |
| Equilibrado | 2 físicos + 2 especiais + 1 misto + 1 tank |
| Defensivo | 2 físicos + 2 especiais + 2 tanks |

A busca descarta qualquer time parcial que já não caiba na composição, então o resultado é o
melhor time que respeita a regra.

## Held items

Opcional (caixa "Sugerir held items"). Em `src/lib/items.ts`, cada membro recebe notas para os
itens de uma lista curada, com regras simples:

- **específicos**: Light Ball (Pikachu), Thick Club (Cubone/Marowak), Flame Orb (Guts),
  Toxic Orb (Poison Heal); Klutz não usa item;
- **ofensivos**: booster do tipo do STAB mais forte, Life Orb (melhor com Magic Guard/Sheer Force),
  Choice Band/Specs/Scarf, Expert Belt (com 2+ golpes de cobertura), Muscle Band/Wise Glasses,
  Focus Sash (atacantes frágeis);
- **defensivos**: Leftovers/Black Sludge, Assault Vest, Rocky Helmet, Air Balloon (fraco a
  Terrestre) e Sitrus Berry como opção genérica.

Os itens são distribuídos do melhor par (pokémon, item) para o pior, sem repetir item no time, e
só entram itens que existem na geração. Gen 1, Let's Go e Legends: Arceus não têm held items.

## Movesets e notas

- **Golpes considerados**: só golpes de dano aprendidos por level-up, TM/TR ou tutor no jogo, com
  poder, precisão, tipo e categoria da época (ex.: Bite era Normal na Gen 1; antes da Gen 4 a
  categoria física/especial dependia do tipo). Golpes com recarga, autodestruição ou condições
  especiais ficam de fora (`EXCLUDED_MOVES`).
- **Escolha** (`movesets.ts`): cada membro leva o STAB mais forte de cada tipo dele; as vagas
  restantes vão, uma a uma, para o golpe que mais acrescenta: acertar super efetivo as fraquezas
  do próprio pokémon e do time, e tipos que ninguém do time acerta ainda. O poder efetivo considera
  STAB, precisão, golpes multi-hit e se o golpe usa o melhor atributo (Atk ou SpA) do pokémon.
  Golpes podem se repetir entre membros, e cada membro leva no máximo um golpe por tipo.
- **Nota de defesa**: por tipo de ataque, nota máxima se ninguém é fraco e alguém resiste,
  caindo conforme os membros fracos superam os resistentes.
- **Nota de ataque**: por tipo defensor, conta quantos membros acertam super efetivo com golpes
  fortes (STAB vale mais); tipos que ameaçam o time pesam 50% a mais.
- Faixas: S ≥ 90, A ≥ 80, B ≥ 70, C ≥ 60, D ≥ 50, F abaixo disso.

## Limitações conhecidas

- A PokeAPI não diz exatamente quais formas regionais aparecem em cada jogo: isso é aproximado pela
  tabela `REGIONAL_FORMS` em `scripts/fetch-data.mjs`. Em Sun/Moon, por exemplo, tanto o Rattata de
  Kanto quanto o de Alola entram como candidatos.
- Megas, Gigantamax e outras formas de batalha ficam de fora.
- Pokémon que ainda evoluem não são excluídos; eles apenas perdem para evoluções de BST maior.
- Colosseum e XD não têm pokédex na API e não aparecem na lista.
- Ultra Beasts e Paradox são uma lista manual (`ULTRA_BEASTS` e `PARADOX` no script).
- A API não tem learnsets de Legends: Z-A nem das DLCs: elas usam os do jogo base ou dos jogos
  recentes mais próximos. Movesets ignoram golpes de status, habilidades e itens.
