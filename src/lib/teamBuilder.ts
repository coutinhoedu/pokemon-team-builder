// Monta um time de 6 a partir de um pokémon base, buscando o menor número de fraquezas.
//
// Ideia geral:
//  1. Cada par (pokémon, habilidade) vira um candidato com um vetor de multiplicadores defensivos
//     (um por tipo de ataque). Habilidades como Levitate mudam esse vetor; Truant derruba o valor.
//  2. Para cada perfil defensivo (tipos + efeito da habilidade) fica só o melhor candidato
//     (maior BST, lendários e habilidades ruins penalizados).
//  3. Uma beam search escolhe os 5 membros restantes, um por vez, mantendo os N melhores
//     times parciais; depois uma busca local tenta trocar membros para melhorar o resultado.

import { abilityRating, applyAbilityDefense } from './abilities';
import type { Ability, GamePokemon, TeamMember } from './data';
import { canReachBalance, classifyRole, countRoles, type BalanceStyle, type Role } from './roles';
import { defensiveMultiplier, effectiveness, typesForGen, type TypeName } from './typeChart';

export const TEAM_SIZE = 6;
const BEAM_WIDTH = 300;
const ALTERNATIVES = 3;

/** Pesos da pontuação. Mexa aqui para mudar o "gosto" do builder. */
export const WEIGHTS = {
  weakness: 1, // cada fraqueza de cada membro (4x conta como 2)
  stacked: 1.5, // por tipo de ataque: (fraquezas - resistências)², quando positivo
  unresisted: 2, // tipo que é super efetivo em alguém e ninguém do time resiste
  resisted: 0.5, // bônus por tipo de ataque que pelo menos um membro resiste
  coverage: 0.4, // bônus por tipo defensor que o time acerta super efetivo com STAB
  bstPer100: 1.5, // bônus a cada 100 pontos de BST (a habilidade soma ou subtrai pontos de BST)
  legendary: 6, // penalidade por lendário/mítico/Ultra Beast/Paradox (desencoraja sem proibir)
};

export interface BuildOptions {
  /**
   * Quantas repetições de tipo o time pode ter (0 a 6): cada vez que um tipo aparece de novo conta 1.
   * Ex.: dois Água = 1 repetição; três Água = 2; dois Água e dois Voador = 2.
   */
  maxTypeRepeats: number;
  excludeLegendaries: boolean;
  /** Estilo de "Equilibrar atacantes" (ver BALANCE_STYLES em roles.ts); null = desligado. */
  balance: BalanceStyle | null;
}

export interface TypeSummary {
  type: TypeName;
  multipliers: number[];
  weak: number;
  resist: number;
  immune: number;
}

export interface TeamAnalysis {
  score: number;
  weaknesses: number;
  unresisted: TypeName[];
  covered: TypeName[];
  averageBst: number;
  legendaries: number;
  byType: TypeSummary[];
}

export interface ScoredTeam {
  members: TeamMember[]; // o base sempre em primeiro
  score: number;
}

export interface BuildResult {
  teams: ScoredTeam[]; // o primeiro é o melhor; os outros são alternativas
  candidateCount: number;
}

interface Candidate extends TeamMember {
  defense: number[]; // multiplicador recebido de cada tipo de ataque (já com a habilidade)
  stabHits: boolean[]; // acerta super efetivo cada tipo defensor (com STAB)?
  value: number; // parte individual da nota: BST + habilidade - penalidade de lendário
  role: Role;
}

export const MAX_TYPE_REPEATS = 6;

/** Repetições de tipo no time: para cada tipo, quantas vezes ele aparece além da primeira. */
export function countTypeRepeats(team: GamePokemon[]): number {
  const counts = new Map<TypeName, number>();
  for (const type of team.flatMap((p) => p.types)) counts.set(type, (counts.get(type) ?? 0) + 1);
  return [...counts.values()].reduce((sum, n) => sum + n - 1, 0);
}

/** Lendários, míticos, Ultra Beasts e Paradox recebem a mesma penalidade. */
export const isLegendary = (p: GamePokemon) => p.legendary || p.mythical || p.subLegendary !== null;

function toCandidate(member: TeamMember, attackTypes: TypeName[], gen: number): Candidate {
  const { pokemon, ability } = member;
  return {
    pokemon,
    ability,
    defense: attackTypes.map((attack) =>
      applyAbilityDefense(defensiveMultiplier(attack, pokemon.types, gen), attack, ability),
    ),
    stabHits: attackTypes.map((defend) => pokemon.types.some((own) => effectiveness(own, defend, gen) > 1)),
    value:
      (WEIGHTS.bstPer100 * (pokemon.bst + abilityRating(ability))) / 100 -
      (isLegendary(pokemon) ? WEIGHTS.legendary : 0),
    role: classifyRole(member),
  };
}

/** Um candidato por habilidade possível (ou um só, sem habilidade, antes da Gen 3). */
function variants(pokemon: GamePokemon, attackTypes: TypeName[], gen: number): Candidate[] {
  const abilities: (Ability | null)[] = pokemon.abilities.length > 0 ? pokemon.abilities : [null];
  return abilities.map((ability) => toCandidate({ pokemon, ability }, attackTypes, gen));
}

interface Evaluation {
  total: number;
  weaknesses: number;
}

function evaluate(team: Candidate[], typeCount: number): Evaluation {
  let weaknesses = 0;
  let stacked = 0;
  let unresisted = 0;
  let resisted = 0;
  let covered = 0;

  for (let t = 0; t < typeCount; t++) {
    let weak = 0;
    let resist = 0;
    let hits = false;
    for (const member of team) {
      const mult = member.defense[t];
      if (mult > 1) weak += mult >= 4 ? 2 : 1;
      else if (mult < 1) resist++;
      if (member.stabHits[t]) hits = true;
    }
    weaknesses += weak;
    if (weak > resist) stacked += (weak - resist) ** 2;
    if (weak > 0 && resist === 0) unresisted++;
    if (resist > 0) resisted++;
    if (hits) covered++;
  }

  const individual = team.reduce((sum, member) => sum + member.value, 0);
  const total =
    individual +
    WEIGHTS.resisted * resisted +
    WEIGHTS.coverage * covered -
    WEIGHTS.weakness * weaknesses -
    WEIGHTS.stacked * stacked -
    WEIGHTS.unresisted * unresisted;
  return { total, weaknesses };
}

/**
 * Para cada perfil (tipos + efeito defensivo da habilidade + papel), mantém só o candidato de maior
 * valor. O papel entra na chave para a opção de equilibrar atacantes ter opções de cada tipo.
 */
function bestPerProfile(candidates: Candidate[]): Candidate[] {
  const best = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = `${[...candidate.pokemon.types].sort().join('/')}|${candidate.defense.join(',')}|${candidate.role}`;
    const current = best.get(key);
    if (
      !current ||
      candidate.value > current.value ||
      (candidate.value === current.value && candidate.pokemon.id < current.pokemon.id)
    ) {
      best.set(key, candidate);
    }
  }
  return [...best.values()];
}

export function buildTeam(
  base: GamePokemon,
  pool: GamePokemon[],
  gen: number,
  options: BuildOptions,
): BuildResult {
  const attackTypes = typesForGen(gen);
  const typeCount = attackTypes.length;
  const baseVariants = variants(base, attackTypes, gen);

  const candidates = bestPerProfile(
    pool
      .filter((p) => p.speciesId !== base.speciesId)
      .filter((p) => !(options.excludeLegendaries && isLegendary(p)))
      .filter((p) => options.maxTypeRepeats > 0 || !p.types.some((t) => base.types.includes(t)))
      .flatMap((p) => variants(p, attackTypes, gen)),
  );

  // Um estado da busca: qual habilidade do base + índices dos candidatos escolhidos.
  interface State {
    baseIndex: number;
    indices: number[];
    score: number;
  }
  const teamOf = (baseIndex: number, indices: number[]) => [
    baseVariants[baseIndex],
    ...indices.map((i) => candidates[i]),
  ];
  const score = (baseIndex: number, indices: number[]) => evaluate(teamOf(baseIndex, indices), typeCount).total;

  // Com a opção de equilibrar atacantes, o time precisa continuar cabendo numa composição aceita.
  const { balance } = options;
  const balanced = (team: Candidate[]) =>
    balance === null || canReachBalance(countRoles(team.map((c) => c.role)), balance);

  // Não pode repetir espécie (duas habilidades do mesmo pokémon são candidatos diferentes) nem
  // passar do limite de repetições de tipo.
  const fits = (baseIndex: number, indices: number[], candidateIndex: number) => {
    const team = teamOf(baseIndex, indices);
    const candidate = candidates[candidateIndex];
    if (team.some((c) => c.pokemon.speciesId === candidate.pokemon.speciesId)) return false;
    if (!balanced([...team, candidate])) return false;
    return countTypeRepeats([...team, candidate].map((c) => c.pokemon)) <= options.maxTypeRepeats;
  };

  // 1) Beam search: adiciona um membro por vez e guarda os BEAM_WIDTH melhores times parciais.
  let beam: State[] = baseVariants.map((_, baseIndex) => ({ baseIndex, indices: [], score: score(baseIndex, []) }));
  for (let slot = 1; slot < TEAM_SIZE; slot++) {
    const seen = new Set<string>();
    const next: State[] = [];
    for (const state of beam) {
      for (let i = 0; i < candidates.length; i++) {
        if (state.indices.includes(i) || !fits(state.baseIndex, state.indices, i)) continue;
        const indices = [...state.indices, i].sort((a, b) => a - b);
        const key = `${state.baseIndex}:${indices.join(',')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ baseIndex: state.baseIndex, indices, score: score(state.baseIndex, indices) });
      }
    }
    if (next.length === 0) break; // não há mais candidatos válidos: o time fica menor
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, BEAM_WIDTH);
  }

  // 2) Busca local: tenta trocar cada membro (e a habilidade do base) enquanto houver melhora.
  const improve = (start: State): State => {
    let { baseIndex, indices } = start;
    let current = score(baseIndex, indices);
    let improved = true;
    while (improved) {
      improved = false;
      for (let b = 0; b < baseVariants.length; b++) {
        if (!balanced(teamOf(b, indices))) continue;
        const trialScore = score(b, indices);
        if (trialScore > current + 1e-9) {
          baseIndex = b;
          current = trialScore;
          improved = true;
        }
      }
      for (let slot = 0; slot < indices.length; slot++) {
        const others = indices.filter((_, j) => j !== slot);
        for (let i = 0; i < candidates.length; i++) {
          if (indices.includes(i) || !fits(baseIndex, others, i)) continue;
          const trial = [...others, i].sort((a, b) => a - b);
          const trialScore = score(baseIndex, trial);
          if (trialScore > current + 1e-9) {
            indices = trial;
            current = trialScore;
            improved = true;
            break;
          }
        }
      }
    }
    return { baseIndex, indices, score: current };
  };

  const finals = new Map<string, State>();
  for (const state of beam.slice(0, ALTERNATIVES * 3)) {
    const result = improve(state);
    finals.set(`${result.baseIndex}:${result.indices.join(',')}`, result);
  }

  // Times que só diferem na habilidade do base não contam como alternativas diferentes.
  const distinct = new Map<string, State>();
  for (const state of [...finals.values()].sort((a, b) => b.score - a.score)) {
    const key = state.indices.join(',');
    if (!distinct.has(key)) distinct.set(key, state);
  }

  const toMember = (c: Candidate): TeamMember => ({ pokemon: c.pokemon, ability: c.ability });
  const teams = [...distinct.values()].slice(0, ALTERNATIVES).map((state) => {
    // ordena por BST para ficar mais legível, mantendo o base sempre em primeiro
    const rest = state.indices.map((i) => candidates[i]).sort((a, b) => b.pokemon.bst - a.pokemon.bst);
    return { members: [baseVariants[state.baseIndex], ...rest].map(toMember), score: state.score };
  });

  return { teams, candidateCount: candidates.length };
}

/** Detalha a defesa do time tipo a tipo (usado pela tabela da interface). */
export function analyzeTeam(team: TeamMember[], gen: number): TeamAnalysis {
  const attackTypes = typesForGen(gen);
  const members = team.map((m) => toCandidate(m, attackTypes, gen));
  const { total, weaknesses } = evaluate(members, attackTypes.length);

  const byType = attackTypes.map((type, t) => {
    const multipliers = members.map((m) => m.defense[t]);
    return {
      type,
      multipliers,
      weak: multipliers.filter((m) => m > 1).length,
      resist: multipliers.filter((m) => m < 1 && m > 0).length,
      immune: multipliers.filter((m) => m === 0).length,
    };
  });

  return {
    score: total,
    weaknesses,
    unresisted: byType.filter((r) => r.weak > 0 && r.resist + r.immune === 0).map((r) => r.type),
    covered: attackTypes.filter((_, t) => members.some((m) => m.stabHits[t])),
    averageBst: Math.round(team.reduce((sum, m) => sum + m.pokemon.bst, 0) / Math.max(team.length, 1)),
    legendaries: team.filter((m) => isLegendary(m.pokemon)).length,
    byType,
  };
}
