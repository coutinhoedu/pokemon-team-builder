// Cobertura ofensiva do time (tipos dos pokémon + golpes sugeridos) e notas de S a F.

import type { GamePokemon } from './data';
import type { Moveset } from './movesets';
import type { TeamAnalysis } from './teamBuilder';
import { effectiveness, typesForGen, type TypeName } from './typeChart';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface GradeResult {
  grade: Grade;
  score: number; // 0 a 100
}

export interface OffenseCell {
  multiplier: number; // melhor multiplicador que o membro consegue contra o tipo
  source: string | null; // golpe (ou tipo, sem moveset) que dá esse multiplicador
  stab: boolean;
  strength: number;
}

// Golpes super efetivos mais fracos que isso não contam para a nota ofensiva.
const RELEVANT_STRENGTH = 60;

export interface OffenseRow {
  type: TypeName;
  cells: OffenseCell[];
  hitters: number; // quantos membros acertam super efetivo
}

export interface OffenseAnalysis {
  rows: OffenseRow[];
  byStab: TypeName[]; // acertados super efetivo pelo próprio tipo de algum membro
  byMovesOnly: TypeName[]; // só pelos golpes de cobertura
  uncovered: TypeName[];
  grade: GradeResult;
}

const GRADE_THRESHOLDS: [Grade, number][] = [
  ['S', 90],
  ['A', 80],
  ['B', 70],
  ['C', 60],
  ['D', 50],
];

export function toGrade(score: number): GradeResult {
  const rounded = Math.round(score);
  const grade = GRADE_THRESHOLDS.find(([, min]) => rounded >= min)?.[0] ?? 'F';
  return { grade, score: rounded };
}

const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);

/**
 * Nota defensiva: para cada tipo de ataque, 1 se ninguém é fraco e alguém resiste,
 * caindo conforme o número de fracos supera o de resistentes.
 */
export function gradeDefense(analysis: TeamAnalysis): GradeResult {
  const points = analysis.byType.map(({ weak, resist, immune }) => {
    const res = resist + immune;
    if (weak === 0) return res > 0 ? 1 : 0.85;
    if (res >= weak) return 0.75;
    if (res > 0) return Math.max(0, 0.45 - 0.15 * (weak - res - 1));
    return Math.max(0, 0.25 - 0.1 * (weak - 1));
  });
  return toGrade(average(points) * 100);
}

export function analyzeOffense(
  team: GamePokemon[],
  movesets: Moveset[],
  gen: number,
  defense: TeamAnalysis,
): OffenseAnalysis {
  const types = typesForGen(gen);
  // Sem golpes (jogo sem learnset), o membro ataca só com os próprios tipos.
  const attacks = team.map((p) => {
    const moves = movesets.find((m) => m.pokemonId === p.id)?.moves ?? [];
    return moves.length > 0
      ? moves.map((m) => ({ type: m.type, name: m.name, stab: m.stab, strength: m.strength }))
      : p.types.map((t) => ({ type: t, name: null, stab: true, strength: 100 }));
  });

  const rows = types.map((defend) => {
    const cells = attacks.map((list) => {
      let best: OffenseCell = { multiplier: 0, source: null, stab: false, strength: 0 };
      for (const attack of list) {
        const multiplier = effectiveness(attack.type, defend, gen);
        const better =
          multiplier > best.multiplier ||
          (multiplier === best.multiplier && attack.strength > best.strength);
        if (better) best = { multiplier, source: attack.name, stab: attack.stab, strength: attack.strength };
      }
      return best;
    });
    return { type: defend, cells, hitters: cells.filter((c) => c.multiplier > 1).length };
  });

  const byStab = types.filter((defend) =>
    team.some((p) => p.types.some((own) => effectiveness(own, defend, gen) > 1)),
  );
  const byMovesOnly = rows.filter((r) => r.hitters > 0 && !byStab.includes(r.type)).map((r) => r.type);
  const uncovered = rows.filter((r) => r.hitters === 0 && !byStab.includes(r.type)).map((r) => r.type);

  // Nota ofensiva, por tipo defensor: cada membro que acerta super efetivo com um golpe forte
  // soma 1 (STAB) ou 0,6 (cobertura); 2 pontos já valem nota máxima. Sem super efetivo,
  // acerto neutro vale 0,3. Tipos que ameaçam o time pesam 50% a mais.
  const threatened = new Set(defense.byType.filter((r) => r.weak > r.resist + r.immune).map((r) => r.type));
  let total = 0;
  let weights = 0;
  for (const row of rows) {
    const weight = threatened.has(row.type) ? 1.5 : 1;
    const hitPoints = row.cells
      .filter((c) => c.multiplier > 1 && c.strength >= RELEVANT_STRENGTH)
      .reduce((sum, c) => sum + (c.stab ? 1 : 0.6), 0);
    const best = Math.max(...row.cells.map((c) => c.multiplier));
    const points = hitPoints > 0 ? Math.min(1, hitPoints / 2) : best >= 1 ? 0.3 : 0;
    total += weight * points;
    weights += weight;
  }

  return { rows, byStab, byMovesOnly, uncovered, grade: toGrade((total / weights) * 100) };
}
