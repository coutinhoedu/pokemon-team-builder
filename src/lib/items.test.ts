import { describe, expect, it } from 'vitest';
import type { Ability, GamePokemon, TeamMember } from './data';
import { heldItemsAvailable, suggestItems } from './items';
import type { Moveset } from './movesets';
import type { TypeName } from './typeChart';

let nextId = 1;
function member(name: string, types: TypeName[], stats: Partial<GamePokemon> = {}, abilityId?: string): TeamMember {
  const id = nextId++;
  const ability: Ability | null = abilityId ? { id: abilityId, name: abilityId, description: '', hidden: false } : null;
  return {
    pokemon: {
      id, name, displayName: name, speciesId: id, types,
      bst: 500, hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80,
      abilities: ability ? [ability] : [], legendary: false, mythical: false, subLegendary: null, sprite: null,
      ...stats,
    },
    ability,
  };
}

const noMoves = (team: TeamMember[]): Moveset[] => team.map((m) => ({ pokemonId: m.pokemon.id, moves: [] }));

describe('suggestItems', () => {
  it('dá itens exclusivos e respeita habilidades', () => {
    const team = [
      member('pikachu', ['electric'], { atk: 55, spa: 50 }),
      member('lopunny', ['normal'], {}, 'klutz'),
      member('heracross', ['bug', 'fighting'], { atk: 125 }, 'guts'),
    ];
    const [pikachu, lopunny, heracross] = suggestItems(team, noMoves(team), 9);
    expect(pikachu.item?.id).toBe('light-ball');
    expect(lopunny.item).toBeNull();
    expect(heracross.item?.id).toBe('flame-orb');
  });

  it('não repete itens no time', () => {
    const team = ['a', 'b', 'c', 'd'].map((n) => member(n, ['water'], { hp: 110, def: 100, spd: 100 }));
    const ids = suggestItems(team, noMoves(team), 9).map((s) => s.item?.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('só sugere itens que existem na geração', () => {
    const team = [member('alakazam', ['psychic'], { hp: 55, def: 45, spa: 135, spd: 95, spe: 120 })];
    const [gen3] = suggestItems(team, noMoves(team), 3);
    expect(['life-orb', 'choice-specs', 'focus-sash', 'wise-glasses']).not.toContain(gen3.item?.id);
  });

  it('sabe em quais jogos não há held items', () => {
    expect(heldItemsAvailable('red-blue', 1)).toBe(false);
    expect(heldItemsAvailable('legends-arceus', 8)).toBe(false);
    expect(heldItemsAvailable('scarlet-violet', 9)).toBe(true);
  });
});
