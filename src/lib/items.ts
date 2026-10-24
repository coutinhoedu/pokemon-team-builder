// Sugestão de held items. Cada membro recebe uma lista de itens possíveis com uma nota
// (regras simples baseadas em atributos, habilidade e moveset); depois os itens são
// distribuídos do maior para o menor valor, sem repetir item no time.

import { applyAbilityDefense } from './abilities';
import type { TeamMember } from './data';
import type { Moveset, SuggestedMove } from './movesets';
import { defensiveMultiplier, type TypeName } from './typeChart';
import { TYPE_LABELS } from './typeInfo';

export interface HeldItem {
  id: string;
  name: string;
}

export interface ItemSuggestion {
  pokemonId: number;
  item: HeldItem | null;
  reason: string;
}

/** Itens considerados, com a geração em que surgiram. */
const ITEMS: Record<string, { name: string; gen: number }> = {
  'silk-scarf': { name: 'Silk Scarf', gen: 3 },
  charcoal: { name: 'Charcoal', gen: 2 },
  'mystic-water': { name: 'Mystic Water', gen: 2 },
  magnet: { name: 'Magnet', gen: 2 },
  'miracle-seed': { name: 'Miracle Seed', gen: 2 },
  'never-melt-ice': { name: 'Never-Melt Ice', gen: 2 },
  'black-belt': { name: 'Black Belt', gen: 2 },
  'poison-barb': { name: 'Poison Barb', gen: 2 },
  'soft-sand': { name: 'Soft Sand', gen: 2 },
  'sharp-beak': { name: 'Sharp Beak', gen: 2 },
  'twisted-spoon': { name: 'Twisted Spoon', gen: 2 },
  'silver-powder': { name: 'Silver Powder', gen: 2 },
  'hard-stone': { name: 'Hard Stone', gen: 2 },
  'spell-tag': { name: 'Spell Tag', gen: 2 },
  'dragon-fang': { name: 'Dragon Fang', gen: 2 },
  'black-glasses': { name: 'Black Glasses', gen: 2 },
  'metal-coat': { name: 'Metal Coat', gen: 2 },
  'pixie-plate': { name: 'Pixie Plate', gen: 6 },
  'fairy-feather': { name: 'Fairy Feather', gen: 9 },
  leftovers: { name: 'Leftovers', gen: 2 },
  'light-ball': { name: 'Light Ball', gen: 2 },
  'thick-club': { name: 'Thick Club', gen: 2 },
  'choice-band': { name: 'Choice Band', gen: 3 },
  'sitrus-berry': { name: 'Sitrus Berry', gen: 3 },
  'life-orb': { name: 'Life Orb', gen: 4 },
  'choice-specs': { name: 'Choice Specs', gen: 4 },
  'choice-scarf': { name: 'Choice Scarf', gen: 4 },
  'expert-belt': { name: 'Expert Belt', gen: 4 },
  'focus-sash': { name: 'Focus Sash', gen: 4 },
  'muscle-band': { name: 'Muscle Band', gen: 4 },
  'wise-glasses': { name: 'Wise Glasses', gen: 4 },
  'black-sludge': { name: 'Black Sludge', gen: 4 },
  'flame-orb': { name: 'Flame Orb', gen: 4 },
  'toxic-orb': { name: 'Toxic Orb', gen: 4 },
  'rocky-helmet': { name: 'Rocky Helmet', gen: 5 },
  'air-balloon': { name: 'Air Balloon', gen: 5 },
  'assault-vest': { name: 'Assault Vest', gen: 6 },
};

const TYPE_BOOSTERS: Record<TypeName, string> = {
  normal: 'silk-scarf',
  fire: 'charcoal',
  water: 'mystic-water',
  electric: 'magnet',
  grass: 'miracle-seed',
  ice: 'never-melt-ice',
  fighting: 'black-belt',
  poison: 'poison-barb',
  ground: 'soft-sand',
  flying: 'sharp-beak',
  psychic: 'twisted-spoon',
  bug: 'silver-powder',
  rock: 'hard-stone',
  ghost: 'spell-tag',
  dragon: 'dragon-fang',
  dark: 'black-glasses',
  steel: 'metal-coat',
  fairy: 'fairy-feather',
};

// Let's Go e Legends: Arceus não têm held items; na Gen 1 eles ainda não existiam.
const NO_HELD_ITEM_GAMES = new Set(['lets-go-pikachu-lets-go-eevee', 'legends-arceus']);

export const heldItemsAvailable = (gameId: string, gen: number) => gen >= 2 && !NO_HELD_ITEM_GAMES.has(gameId);

export const itemSprite = (id: string) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${id}.png`;

interface Option {
  id: string;
  score: number;
  reason: string;
}

function itemOptions({ pokemon: p, ability }: TeamMember, moves: SuggestedMove[], gen: number): Option[] {
  const options: Option[] = [];
  const add = (id: string, score: number, reason: string) => {
    if (ITEMS[id].gen <= gen) options.push({ id, score, reason });
  };

  const hugePower = ability?.id === 'huge-power' || ability?.id === 'pure-power';
  const atk = p.atk * (hugePower ? 2 : 1);
  const physical = atk >= p.spa;
  const offense = Math.max(atk, p.spa);
  const bulk = (p.hp + p.def + p.spd) / 3;
  const attacker = offense >= 95 && offense >= bulk * 1.1;
  const category = physical ? 'físicos' : 'especiais';

  // Itens que só fazem sentido com uma habilidade ou pokémon específicos.
  if (ability?.id === 'guts') {
    add('flame-orb', 10, 'Ativa Guts: queimado, o Ataque sobe 50% (e Guts ignora a redução de Ataque da queimadura).');
  }
  if (ability?.id === 'poison-heal') add('toxic-orb', 10, 'Ativa Poison Heal: o envenenamento passa a recuperar HP todo turno.');
  if (p.name.startsWith('pikachu')) add('light-ball', 12, 'Item exclusivo: dobra o poder ofensivo do Pikachu.');
  if (p.name.startsWith('cubone') || p.name.startsWith('marowak')) {
    add('thick-club', 12, 'Item exclusivo: dobra o Ataque de Cubone e Marowak.');
  }

  // Ofensivos.
  const bestStab = moves.filter((m) => m.stab).sort((a, b) => b.strength - a.strength)[0];
  if (bestStab) {
    const booster = bestStab.type === 'fairy' && gen < 9 ? 'pixie-plate' : TYPE_BOOSTERS[bestStab.type];
    add(
      booster,
      3.2 + (offense - 80) / 50,
      `Golpes do tipo ${TYPE_LABELS[bestStab.type]} ${gen >= 4 ? '20%' : '10%'} mais fortes, como ${bestStab.name}. Sem desvantagens.`,
    );
  }
  if (attacker) {
    const noRecoil = ability?.id === 'magic-guard' || ability?.id === 'sheer-force';
    add(
      'life-orb',
      4 + (offense - 95) / 25 + (noRecoil ? 3 : 0),
      noRecoil
        ? `Golpes 30% mais fortes, e ${ability!.name} evita o dano de recuo.`
        : 'Golpes 30% mais fortes, em troca de 10% do HP a cada ataque.',
    );
    if (p.spe >= 80) {
      add(
        physical ? 'choice-band' : 'choice-specs',
        3.5 + (offense - 95) / 25,
        `Golpes ${category} 50% mais fortes, mas fica preso ao primeiro golpe usado até sair da batalha.`,
      );
    }
    if (p.spe >= 60 && p.spe < 100) {
      add('choice-scarf', 3.2, 'Velocidade 50% maior para atacar primeiro, mas fica preso ao primeiro golpe usado.');
    }
    add(physical ? 'muscle-band' : 'wise-glasses', 3, `Golpes ${category} 10% mais fortes, sem desvantagens.`);
    if (bulk < 70) add('focus-sash', 3.5, 'Com HP cheio, sobrevive a qualquer golpe com 1 de HP: bom para atacantes frágeis.');
  }
  const coverageMoves = moves.filter((m) => !m.stab).length;
  if (coverageMoves >= 2) {
    add('expert-belt', 3 + coverageMoves * 0.3, 'Golpes super efetivos 20% mais fortes: aproveita os golpes de cobertura.');
  }

  // Defensivos.
  if (bulk >= 80 || p.hp >= 100) {
    const score = 3.5 + (bulk - 80) / 20;
    if (p.types.includes('poison')) {
      add('black-sludge', score + 0.2, 'Recupera 1/16 do HP por turno (em tipos Venenoso, igual ao Leftovers).');
    }
    add('leftovers', score, 'Recupera 1/16 do HP por turno: bom para quem aguenta bastante dano.');
  }
  const specialBulk = (p.hp + p.spd) / 2;
  if (moves.length > 0 && specialBulk >= 80) {
    add(
      'assault-vest',
      3.3 + (specialBulk - 80) / 20,
      'Defesa Especial 50% maior; só permite golpes de dano, que é o que o moveset sugerido usa.',
    );
  }
  if (p.def >= 100) add('rocky-helmet', 2.8 + (p.def - 100) / 40, 'Quem atacar com contato perde 1/6 do HP: combina com Defesa alta.');
  const ground = applyAbilityDefense(defensiveMultiplier('ground', p.types, gen), 'ground', ability);
  if (ground > 1) {
    add('air-balloon', 2.5 + (ground >= 4 ? 1 : 0), 'Imune a golpes Terrestres até ser atingido: cobre uma fraqueza.');
  }
  add('sitrus-berry', 2, 'Recupera 25% do HP quando fica com metade da vida: opção segura para qualquer um.');

  return options;
}

export function suggestItems(team: TeamMember[], movesets: Moveset[], gen: number): ItemSuggestion[] {
  const options = team
    .flatMap((member, index) => {
      if (member.ability?.id === 'klutz') return [];
      const moves = movesets.find((m) => m.pokemonId === member.pokemon.id)?.moves ?? [];
      return itemOptions(member, moves, gen).map((option) => ({ ...option, index }));
    })
    .sort((a, b) => b.score - a.score);

  // Distribui do melhor par (membro, item) para o pior, sem repetir item.
  const chosen: (ItemSuggestion | undefined)[] = team.map(() => undefined);
  const used = new Set<string>();
  for (const option of options) {
    if (chosen[option.index] || used.has(option.id)) continue;
    used.add(option.id);
    chosen[option.index] = {
      pokemonId: team[option.index].pokemon.id,
      item: { id: option.id, name: ITEMS[option.id].name },
      reason: option.reason,
    };
  }

  return team.map(
    (member, i) =>
      chosen[i] ?? {
        pokemonId: member.pokemon.id,
        item: null,
        reason: member.ability?.id === 'klutz' ? 'Klutz impede o uso de itens.' : 'Nenhum item da lista ajuda aqui.',
      },
  );
}
