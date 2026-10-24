import { describe, expect, it } from 'vitest';
import type { Ability, GamePokemon, TeamMember } from './data';
import { canReachBalance, classifyRole, countRoles, describeCounts, type BalanceStyle, type Role } from './roles';
import { buildTeam } from './teamBuilder';
import type { TypeName } from './typeChart';

let nextId = 1;
function mon(name: string, types: TypeName[], stats: Partial<GamePokemon>): GamePokemon {
  const id = nextId++;
  return {
    id, name, displayName: name, speciesId: id, types,
    bst: 520, hp: 80, atk: 80, def: 80, spa: 80, spd: 80, spe: 80,
    abilities: [], legendary: false, mythical: false, subLegendary: null, sprite: null,
    ...stats,
  };
}

const physical = (name: string, types: TypeName[]) => mon(name, types, { atk: 130, spa: 60, def: 70, spd: 70 });
const special = (name: string, types: TypeName[]) => mon(name, types, { atk: 60, spa: 130, def: 70, spd: 70 });
const mixed = (name: string, types: TypeName[]) => mon(name, types, { atk: 110, spa: 105, def: 70, spd: 70 });
const tank = (name: string, types: TypeName[]) => mon(name, types, { hp: 110, def: 120, spd: 110, atk: 80, spa: 60 });
const asMember = (pokemon: GamePokemon, ability: Ability | null = null): TeamMember => ({ pokemon, ability });

describe('classifyRole', () => {
  it('classifica pelos atributos', () => {
    expect(classifyRole(asMember(physical('a', ['normal'])))).toBe('physical');
    expect(classifyRole(asMember(special('b', ['normal'])))).toBe('special');
    expect(classifyRole(asMember(mixed('c', ['normal'])))).toBe('mixed');
    expect(classifyRole(asMember(tank('d', ['normal'])))).toBe('tank');
  });

  it('considera Huge Power', () => {
    const azumarill = mon('azumarill', ['water', 'fairy'], { hp: 100, atk: 50, def: 80, spa: 60, spd: 80 });
    const hugePower: Ability = { id: 'huge-power', name: 'Huge Power', description: '', hidden: false };
    expect(classifyRole(asMember(azumarill))).toBe('tank');
    expect(classifyRole(asMember(azumarill, hugePower))).toBe('physical');
  });
});

describe('composições', () => {
  it('aceita só times que ainda cabem numa composição equilibrada', () => {
    expect(canReachBalance(countRoles(['physical', 'physical', 'physical']), 'auto')).toBe(true);
    expect(canReachBalance(countRoles(['physical', 'physical', 'physical', 'mixed']), 'auto')).toBe(false);
    expect(canReachBalance(countRoles(['tank', 'tank', 'mixed']), 'auto')).toBe(false);
    expect(describeCounts(countRoles(['physical', 'physical', 'special', 'tank']))).toBe('2 físicos · 1 especial · 1 tank');
  });

  it('o builder respeita a composição quando a opção está ligada', () => {
    const pool = [
      physical('p1', ['fighting']), physical('p2', ['ground']), physical('p3', ['rock']), physical('p4', ['bug']),
      special('s1', ['water']), special('s2', ['psychic']), special('s3', ['fire']), special('s4', ['ghost']),
      mixed('m1', ['dragon']), mixed('m2', ['dark']),
      tank('t1', ['steel']), tank('t2', ['fairy']), tank('t3', ['grass']), tank('t4', ['poison']),
    ];
    const base = tank('base', ['normal']);
    const { teams } = buildTeam(base, pool, 9, { maxTypeRepeats: 0, excludeLegendaries: false, balance: 'auto' });
    const counts = countRoles(teams[0].members.map((m) => classifyRole(m)));
    expect(teams[0].members).toHaveLength(6);
    expect(counts.physical).toBe(2);
    expect(counts.special).toBe(2);
    expect(counts.mixed + counts.tank).toBe(2);
    expect(counts.tank).toBeGreaterThanOrEqual(1); // o base é tank
    const roles: Role[] = ['physical', 'special'];
    expect(roles.every((r) => counts[r] <= 3)).toBe(true);
  });

  it('cada estilo fixa as vagas flexíveis', () => {
    const pool = [
      physical('p1', ['fighting']), physical('p2', ['ground']), physical('p3', ['rock']),
      special('s1', ['water']), special('s2', ['psychic']), special('s3', ['fire']),
      mixed('m1', ['dragon']), mixed('m2', ['dark']), mixed('m3', ['ice']),
      tank('t1', ['steel']), tank('t2', ['fairy']), tank('t3', ['grass']),
    ];
    const base = physical('base', ['normal']);
    const expected: Record<Exclude<BalanceStyle, 'auto'>, [number, number]> = {
      offensive: [2, 0],
      balanced: [1, 1],
      defensive: [0, 2],
    };
    for (const [style, [mixedCount, tankCount]] of Object.entries(expected) as [BalanceStyle, [number, number]][]) {
      const { teams } = buildTeam(base, pool, 9, { maxTypeRepeats: 0, excludeLegendaries: false, balance: style });
      const counts = countRoles(teams[0].members.map((m) => classifyRole(m)));
      expect(counts).toEqual({ physical: 2, special: 2, mixed: mixedCount, tank: tankCount });
    }
  });
});
