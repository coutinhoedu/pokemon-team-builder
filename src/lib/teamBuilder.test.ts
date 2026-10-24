import { describe, expect, it } from 'vitest';
import type { Ability, GamePokemon } from './data';
import { analyzeTeam, buildTeam, countTypeRepeats, TEAM_SIZE } from './teamBuilder';
import type { TypeName } from './typeChart';

let nextId = 1;
function mon(name: string, types: TypeName[], bst = 500, legendary = false, abilities: string[] = []): GamePokemon {
  const id = nextId++;
  return {
    id, name, displayName: name, speciesId: id, types, bst, hp: 80, atk: 100, def: 80, spa: 100, spd: 80, spe: 80,
    abilities: abilities.map((a): Ability => ({ id: a, name: a, description: '', hidden: false })),
    legendary, mythical: false, subLegendary: null, sprite: null,
  };
}

const pool: GamePokemon[] = [
  mon('charizard', ['fire', 'flying'], 534),
  mon('blastoise', ['water'], 530),
  mon('squirtle', ['water'], 314),
  mon('venusaur', ['grass', 'poison'], 525),
  mon('jolteon', ['electric'], 525),
  mon('gengar', ['ghost', 'poison'], 500),
  mon('machamp', ['fighting'], 505),
  mon('dragonite', ['dragon', 'flying'], 600),
  mon('tyranitar', ['rock', 'dark'], 600),
  mon('metagross', ['steel', 'psychic'], 600),
  mon('garchomp', ['dragon', 'ground'], 600),
  mon('togekiss', ['fairy', 'flying'], 545),
  mon('mamoswine', ['ice', 'ground'], 530),
  mon('scizor', ['bug', 'steel'], 500),
  mon('snorlax', ['normal'], 540),
  mon('mewtwo', ['psychic'], 680, true),
  mon('alakazam', ['psychic'], 500),
];

const names = (members: { pokemon: GamePokemon }[]) => members.map((m) => m.pokemon.name);

describe('buildTeam', () => {
  const base = mon('pikachu', ['electric'], 320);

  it('monta 6 membros com o base em primeiro e sem espécies repetidas', () => {
    const { teams } = buildTeam(base, pool, 9, { maxTypeRepeats: 6, excludeLegendaries: false, balance: null });
    const { members } = teams[0];
    expect(members).toHaveLength(TEAM_SIZE);
    expect(members[0].pokemon).toBe(base);
    expect(new Set(members.map((m) => m.pokemon.speciesId)).size).toBe(TEAM_SIZE);
  });

  it('não repete tipos quando a opção está desligada', () => {
    const { teams } = buildTeam(base, pool, 9, { maxTypeRepeats: 0, excludeLegendaries: false, balance: null });
    const types = teams[0].members.flatMap((m) => m.pokemon.types);
    expect(new Set(types).size).toBe(types.length);
  });

  it('respeita o limite de repetições de tipo', () => {
    // Pool com muitos tipos Voador e Água para tentar o builder a repetir.
    const repeatPool = [
      ...pool,
      mon('pelipper', ['water', 'flying'], 540),
      mon('gyarados', ['water', 'flying'], 540),
      mon('mantine', ['water', 'flying'], 530),
      mon('corviknight', ['flying', 'steel'], 560),
    ];
    for (const maxTypeRepeats of [0, 1, 2]) {
      const { teams } = buildTeam(base, repeatPool, 9, { maxTypeRepeats, excludeLegendaries: false, balance: null });
      expect(countTypeRepeats(teams[0].members.map((m) => m.pokemon))).toBeLessThanOrEqual(maxTypeRepeats);
    }
  });

  it('conta repetições de tipo', () => {
    const water = mon('w', ['water']);
    const waterFlying = mon('wf', ['water', 'flying']);
    const flying = mon('f', ['flying']);
    expect(countTypeRepeats([water, flying])).toBe(0);
    expect(countTypeRepeats([water, waterFlying])).toBe(1);
    expect(countTypeRepeats([water, waterFlying, flying])).toBe(2);
  });

  it('prefere o maior BST e evita lendários com a mesma tipagem', () => {
    const { teams } = buildTeam(base, pool, 9, { maxTypeRepeats: 6, excludeLegendaries: false, balance: null });
    expect(names(teams[0].members)).not.toContain('squirtle');
    expect(names(teams[0].members)).not.toContain('mewtwo');
  });

  it('trata Ultra Beasts e Paradox como lendários', () => {
    const paradoxPool = [...pool, { ...mon('iron-hands', ['fighting', 'electric'], 570), subLegendary: 'paradox' as const }];
    const { teams } = buildTeam(base, paradoxPool, 9, { maxTypeRepeats: 6, excludeLegendaries: true, balance: null });
    expect(names(teams[0].members)).not.toContain('iron-hands');
  });

  it('exclui lendários completamente quando pedido', () => {
    const legendaryPool = [...pool, mon('lugia', ['psychic', 'flying'], 680, true)];
    const { teams } = buildTeam(base, legendaryPool, 9, { maxTypeRepeats: 6, excludeLegendaries: true, balance: null });
    expect(teams[0].members.some((m) => m.pokemon.legendary)).toBe(false);
  });

  it('evita habilidades prejudiciais como Truant', () => {
    const truantPool = [...pool.filter((p) => p.name !== 'snorlax'), mon('slaking', ['normal'], 670, false, ['truant']), mon('ursaring', ['normal'], 500)];
    const { teams } = buildTeam(base, truantPool, 9, { maxTypeRepeats: 6, excludeLegendaries: false, balance: null });
    expect(names(teams[0].members)).not.toContain('slaking');
  });

  it('escolhe a melhor habilidade quando há mais de uma', () => {
    const lopunny = mon('lopunny', ['normal'], 480, false, ['klutz', 'limber']);
    const { teams } = buildTeam(lopunny, pool, 9, { maxTypeRepeats: 6, excludeLegendaries: false, balance: null });
    expect(teams[0].members[0].ability?.id).toBe('limber');
  });
});

describe('analyzeTeam', () => {
  it('conta fraquezas e tipos sem resistência', () => {
    const analysis = analyzeTeam(
      [mon('a', ['grass']), mon('b', ['grass'])].map((pokemon) => ({ pokemon, ability: null })),
      9,
    );
    const fire = analysis.byType.find((r) => r.type === 'fire')!;
    expect(fire.weak).toBe(2);
    expect(analysis.unresisted).toContain('fire');
    expect(analysis.unresisted).not.toContain('water');
  });

  it('aplica imunidades de habilidade (Levitate)', () => {
    const gengar = mon('gengar', ['ghost', 'poison'], 500, false, ['levitate']);
    const analysis = analyzeTeam([{ pokemon: gengar, ability: gengar.abilities[0] }], 9);
    expect(analysis.byType.find((r) => r.type === 'ground')!.immune).toBe(1);
  });
});
