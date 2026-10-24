// Formato dos arquivos em public/data (gerados por scripts/fetch-data.mjs) e a conversão
// deles para os dados "como eram" na geração do jogo escolhido.

import { typesForGen, type TypeName } from './typeChart';

interface PerGen<T> {
  gen: number;
  value: T;
}

export type SubLegendary = 'ultra-beast' | 'paradox';

interface StatSummary {
  bst: number;
  hp: number;
  atk: number;
  def: number;
  spa: number; // na Gen 1, o "Special" único
  spd: number;
  spe: number;
}

export interface PokemonRecord extends StatSummary {
  id: number;
  name: string;
  displayName: string;
  speciesId: number;
  speciesName: string;
  types: TypeName[];
  pastTypes: { gen: number; types: TypeName[] }[];
  pastStats: (StatSummary & { gen: number })[];
  abilities: AbilityRef[];
  pastAbilities: { gen: number; abilities: AbilityRef[] }[];
  legendary: boolean;
  mythical: boolean;
  subLegendary: SubLegendary | null;
  introGen: number;
  region: string | null;
  sprite: string | null;
}

type AbilityRef = [name: string, hidden: boolean];

export interface Ability {
  id: string; // ex.: "huge-power"
  name: string; // ex.: "Huge Power"
  description: string;
  hidden: boolean;
}

export interface GameRecord {
  id: string;
  label: string;
  gen: number;
  approximateLearnsets: boolean;
  pokemon: number[];
}

export interface Dataset {
  generatedAt: string;
  games: GameRecord[];
  pokemon: PokemonRecord[];
  abilities: Record<string, [name: string, description: string, introGen: number]>;
}

/** Um pokémon já resolvido para a geração de um jogo. */
export interface GamePokemon extends StatSummary {
  id: number;
  name: string;
  displayName: string;
  speciesId: number;
  types: TypeName[];
  abilities: Ability[]; // vazio antes da Gen 3
  legendary: boolean;
  mythical: boolean;
  subLegendary: SubLegendary | null;
  sprite: string | null;
}

/** Um membro do time: o pokémon e a habilidade sugerida para ele. */
export interface TeamMember {
  pokemon: GamePokemon;
  ability: Ability | null;
}

export type MoveCategory = 'physical' | 'special';

export interface Move {
  id: number;
  name: string;
  type: TypeName;
  power: number;
  accuracy: number | null; // null = nunca erra
  category: MoveCategory;
  hits: number; // média de acertos (golpes multi-hit)
}

export interface GameMoves {
  moves: Map<number, Move>;
  learnsets: Map<number, number[]>; // pokemonId -> ids dos golpes de dano que ele aprende
}

type MoveTuple = [string, TypeName, number, number | null, MoveCategory, number];

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

export async function loadDataset(): Promise<Dataset> {
  const res = await fetch(dataUrl('pokedex.json'));
  if (!res.ok) throw new Error(`Não foi possível carregar os dados (HTTP ${res.status}). Rodou "npm run fetch-data"?`);
  return res.json();
}

export async function loadGameMoves(gameId: string): Promise<GameMoves> {
  const res = await fetch(dataUrl(`games/${gameId}.json`));
  if (!res.ok) throw new Error(`Não foi possível carregar os golpes de ${gameId} (HTTP ${res.status}).`);
  const raw: { moves: Record<string, MoveTuple>; learnsets: Record<string, number[]> } = await res.json();

  const moves = new Map<number, Move>();
  for (const [id, [name, type, power, accuracy, category, hits]] of Object.entries(raw.moves)) {
    moves.set(Number(id), { id: Number(id), name, type, power, accuracy, category, hits });
  }
  const learnsets = new Map(Object.entries(raw.learnsets).map(([id, ids]) => [Number(id), ids]));
  return { moves, learnsets };
}

// As entradas "past" valem até e incluindo a geração indicada: usamos a de menor geração >= gen.
function valueForGen<T>(entries: PerGen<T>[], gen: number, current: T): T {
  const match = entries.filter((e) => e.gen >= gen).sort((a, b) => a.gen - b.gen)[0];
  return match ? match.value : current;
}

export function resolveForGame(dataset: Dataset, game: GameRecord): GamePokemon[] {
  const byId = new Map(dataset.pokemon.map((p) => [p.id, p]));
  const validTypes = new Set(typesForGen(game.gen));
  const result: GamePokemon[] = [];

  for (const id of game.pokemon) {
    const p = byId.get(id);
    if (!p) continue;
    const types = valueForGen(
      p.pastTypes.map((e) => ({ gen: e.gen, value: e.types })),
      game.gen,
      p.types,
    ).filter((t) => validTypes.has(t));
    if (types.length === 0) continue;

    const stats = valueForGen(
      p.pastStats.map(({ gen, ...value }) => ({ gen, value })),
      game.gen,
      { bst: p.bst, hp: p.hp, atk: p.atk, def: p.def, spa: p.spa, spd: p.spd, spe: p.spe },
    );

    // Habilidades surgiram na Gen 3 e as ocultas na Gen 5.
    const abilities = valueForGen(
      p.pastAbilities.map((e) => ({ gen: e.gen, value: e.abilities })),
      game.gen,
      p.abilities,
    )
      .filter(([id, hidden]) => game.gen >= 3 && (!hidden || game.gen >= 5) && (dataset.abilities[id]?.[2] ?? 0) <= game.gen)
      .map(([id, hidden]) => {
        const [name, description] = dataset.abilities[id] ?? [id, ''];
        return { id, name, description, hidden };
      });

    result.push({
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      speciesId: p.speciesId,
      types,
      abilities,
      ...stats,
      legendary: p.legendary,
      mythical: p.mythical,
      subLegendary: p.subLegendary,
      sprite: p.sprite,
    });
  }
  return result;
}
