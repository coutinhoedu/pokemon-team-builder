import { describe, expect, it } from 'vitest';
import { analyzeOffense, toGrade } from './coverage';
import type { GameMoves, GamePokemon, Move, MoveCategory } from './data';
import { suggestMovesets } from './movesets';
import { analyzeTeam } from './teamBuilder';
import type { TypeName } from './typeChart';

const move = (id: number, name: string, type: TypeName, power: number, category: MoveCategory = 'special'): Move => ({
  id, name, type, power, accuracy: 100, category, hits: 1,
});

const MOVES = [
  move(1, 'Flamethrower', 'fire', 90),
  move(2, 'Ember', 'fire', 40),
  move(3, 'Thunderbolt', 'electric', 90),
  move(4, 'Earthquake', 'ground', 100, 'physical'),
  move(5, 'Rock Slide', 'rock', 75, 'physical'),
  move(6, 'Tackle', 'normal', 40, 'physical'),
  move(7, 'Surf', 'water', 90),
];

const charizard: GamePokemon = {
  id: 6, name: 'charizard', displayName: 'Charizard', speciesId: 6, types: ['fire', 'flying'],
  bst: 534, hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100, abilities: [], legendary: false, mythical: false, subLegendary: null, sprite: null,
};

const gameMoves: GameMoves = {
  moves: new Map(MOVES.map((m) => [m.id, m])),
  learnsets: new Map([[6, [1, 2, 3, 4, 5, 6]]]),
};

describe('suggestMovesets', () => {
  const [set] = suggestMovesets([{ pokemon: charizard, ability: null }], gameMoves, 9);
  const names = set.moves.map((m) => m.name);

  it('sugere no máximo 4 golpes, com o STAB mais forte', () => {
    expect(set.moves.length).toBeLessThanOrEqual(4);
    expect(names).toContain('Flamethrower');
    expect(names).not.toContain('Ember');
  });

  it('prioriza golpes que acertam as próprias fraquezas', () => {
    // Charizard é fraco a Rock, Water e Electric: Thunderbolt acerta Water, Rock Slide/Earthquake acertam Rock e Electric.
    expect(names).toContain('Thunderbolt');
    expect(set.moves.find((m) => m.name === 'Thunderbolt')!.counters).toContain('water');
  });
});

describe('coverage', () => {
  it('converte nota em letra', () => {
    expect(toGrade(95).grade).toBe('S');
    expect(toGrade(72).grade).toBe('B');
    expect(toGrade(10).grade).toBe('F');
  });

  it('separa tipos cobertos por STAB, por golpes e sem cobertura', () => {
    const sets = suggestMovesets([{ pokemon: charizard, ability: null }], gameMoves, 9);
    const offense = analyzeOffense([charizard], sets, 9, analyzeTeam([{ pokemon: charizard, ability: null }], 9));
    expect(offense.byStab).toContain('grass'); // Fire e Flying acertam Grass
    expect(offense.byMovesOnly).toContain('water'); // só via Thunderbolt
    expect(offense.uncovered).not.toContain('water');
  });
});
