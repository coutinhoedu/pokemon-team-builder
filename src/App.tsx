import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BalanceStylePicker } from './components/BalanceStylePicker';
import { DefenseTable } from './components/DefenseTable';
import { GradeCard } from './components/GradeCard';
import { OffenseTable } from './components/OffenseTable';
import { PokemonCard } from './components/PokemonCard';
import { Stepper } from './components/Stepper';
import { Toggle } from './components/Toggle';
import { TypeBadge } from './components/TypeBadge';
import { analyzeOffense, gradeDefense } from './lib/coverage';
import {
  loadDataset,
  loadGameMoves,
  resolveForGame,
  type Dataset,
  type GameMoves,
  type GameRecord,
} from './lib/data';
import { heldItemsAvailable, suggestItems } from './lib/items';
import { suggestMovesets } from './lib/movesets';
import { classifyRole, countRoles, describeCounts, type BalanceStyle } from './lib/roles';
import { analyzeTeam, buildTeam, MAX_TYPE_REPEATS, TEAM_SIZE, type BuildResult } from './lib/teamBuilder';
import type { TypeName } from './lib/typeChart';
import { romanGen } from './lib/typeInfo';

const DEFAULT_GAME = 'scarlet-violet';

function TypeList({ types, empty }: { types: TypeName[]; empty: string }) {
  if (types.length === 0) return <span className="muted">{empty}</span>;
  return (
    <span className="type-list">
      {types.map((t) => (
        <TypeBadge key={t} type={t} />
      ))}
    </span>
  );
}

export default function App() {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gameId, setGameId] = useState(DEFAULT_GAME);
  const [gameMoves, setGameMoves] = useState<{ gameId: string; data: GameMoves } | null>(null);
  const [query, setQuery] = useState('');
  const [maxTypeRepeats, setMaxTypeRepeats] = useState(0);
  const [excludeLegendaries, setExcludeLegendaries] = useState(false);
  const [showItems, setShowItems] = useState(true);
  const [balanceRoles, setBalanceRoles] = useState(false);
  const [balanceStyle, setBalanceStyle] = useState<BalanceStyle>('auto');
  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState<BuildResult | null>(null);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    loadDataset()
      .then(setDataset)
      .catch((err: Error) => setLoadError(err.message));
  }, []);

  const game = dataset?.games.find((g) => g.id === gameId) ?? dataset?.games.at(-1);

  // Os golpes ficam num arquivo por jogo, carregado só quando o jogo é escolhido.
  useEffect(() => {
    if (!game) return;
    let cancelled = false;
    loadGameMoves(game.id)
      .then((data) => !cancelled && setGameMoves({ gameId: game.id, data }))
      .catch((err: Error) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [game]);

  const gamesByGen = useMemo(() => {
    const groups = new Map<number, GameRecord[]>();
    for (const g of dataset?.games ?? []) groups.set(g.gen, [...(groups.get(g.gen) ?? []), g]);
    return [...groups.entries()];
  }, [dataset]);

  const gamePokemon = useMemo(
    () => (dataset && game ? resolveForGame(dataset, game) : []),
    [dataset, game],
  );

  const sortedNames = useMemo(
    () => [...new Set(gamePokemon.map((p) => p.displayName))].sort((a, b) => a.localeCompare(b)),
    [gamePokemon],
  );

  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gamePokemon.find((p) => p.displayName.toLowerCase() === q) ?? null;
  }, [gamePokemon, query]);

  const shown = result?.teams[selected] ?? null;
  const teamPokemon = useMemo(() => shown?.members.map((m) => m.pokemon) ?? [], [shown]);
  const analysis = useMemo(
    () => (shown && game ? analyzeTeam(shown.members, game.gen) : null),
    [shown, game],
  );

  const movesForGame = game && gameMoves?.gameId === game.id ? gameMoves.data : null;
  const movesets = useMemo(
    () => (shown && game && movesForGame ? suggestMovesets(shown.members, movesForGame, game.gen) : null),
    [shown, game, movesForGame],
  );

  const offense = useMemo(
    () => (game && analysis && movesets ? analyzeOffense(teamPokemon, movesets, game.gen, analysis) : null),
    [teamPokemon, game, analysis, movesets],
  );
  const defenseGrade = useMemo(() => (analysis ? gradeDefense(analysis) : null), [analysis]);

  const itemsInGame = game ? heldItemsAvailable(game.id, game.gen) : false;
  const items = useMemo(
    () => (shown && game && movesets && showItems && itemsInGame ? suggestItems(shown.members, movesets, game.gen) : null),
    [shown, game, movesets, showItems, itemsInGame],
  );

  function handleBuild(event: FormEvent) {
    event.preventDefault();
    if (!base || !game) return;
    setBuilding(true);
    // setTimeout deixa o React desenhar o "Montando..." antes do cálculo travar a thread.
    setTimeout(() => {
      setResult(buildTeam(base, gamePokemon, game.gen, {
        maxTypeRepeats,
        excludeLegendaries,
        balance: balanceRoles ? balanceStyle : null,
      }));
      setSelected(0);
      setBuilding(false);
    }, 0);
  }

  if (loadError) {
    return (
      <main className="app">
        <h1>Pokémon Team Builder</h1>
        <p className="error">{loadError}</p>
      </main>
    );
  }

  if (!dataset || !game) {
    return (
      <main className="app">
        <h1>Pokémon Team Builder</h1>
        <p>Carregando dados...</p>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="hero">
        <svg className="hero-ball" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="8" />
          <path d="M6 50h30M64 50h30" stroke="currentColor" strokeWidth="8" />
          <circle cx="50" cy="50" r="13" fill="none" stroke="currentColor" strokeWidth="8" />
        </svg>
        <div className="hero-title">
          <svg className="pokeball" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="46" fill="#fff" stroke="#1c1e21" strokeWidth="8" />
            <path d="M4 50a46 46 0 0 1 92 0z" fill="var(--accent)" stroke="#1c1e21" strokeWidth="8" />
            <circle cx="50" cy="50" r="13" fill="#fff" stroke="#1c1e21" strokeWidth="8" />
          </svg>
          <div>
            <h1>Pokémon Team Builder</h1>
            <p className="subtitle">
              Escolha o jogo e um pokémon base: o builder completa o time com a menor quantidade de
              fraquezas, priorizando BST alto e boas habilidades, e sugere golpes e itens.
            </p>
          </div>
        </div>

        <form className="controls" onSubmit={handleBuild}>
          <div className="controls-main">
            <label className="field">
              Jogo
              <select
                value={game.id}
                onChange={(e) => {
                  setGameId(e.target.value);
                  setResult(null);
                }}
              >
                {gamesByGen.map(([gen, games]) => (
                  <optgroup key={gen} label={`Geração ${romanGen(gen)}`}>
                    {games.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className="field">
              Pokémon base
              <input
                list="pokemon-options"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Digite um nome, ex.: Pikachu"
                autoComplete="off"
              />
              <datalist id="pokemon-options">
                {sortedNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <span className="hint">
                {base ? (
                  <>
                    {base.types.map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}{' '}
                    BST {base.bst}
                  </>
                ) : query ? (
                  `Não encontrado na dex de ${game.label}`
                ) : (
                  `${gamePokemon.length} pokémon disponíveis`
                )}
              </span>
            </label>

            <Stepper
              label="Repetições de tipo"
              hint="0 = nenhum tipo repetido"
              value={maxTypeRepeats}
              min={0}
              max={MAX_TYPE_REPEATS}
              onChange={setMaxTypeRepeats}
            />

            <button type="submit" className="build-button" disabled={!base || building}>
              {building ? 'Montando...' : 'Montar time'}
            </button>
          </div>

          <div className="controls-toggles">
            <Toggle
              label="Equilibrar atacantes"
              hint="Escolha abaixo o estilo do time"
              checked={balanceRoles}
              onChange={setBalanceRoles}
            />
            <Toggle
              label="Excluir lendários e afins"
              hint="Míticos, Ultra Beasts e Paradox também; desligado, só são desencorajados"
              checked={excludeLegendaries}
              onChange={setExcludeLegendaries}
            />
            <Toggle
              label="Sugerir held items"
              hint="Um item por membro, sem repetir"
              checked={showItems}
              onChange={setShowItems}
            />
          </div>

          {balanceRoles && <BalanceStylePicker value={balanceStyle} onChange={setBalanceStyle} />}
        </form>
      </header>

      {result && shown && analysis && (
        <section className="results">
          {result.teams.length > 1 && (
            <div className="alternatives">
              {result.teams.map((t, i) => (
                <button
                  key={t.members.map((m) => m.pokemon.id).join()}
                  className={i === selected ? 'active' : undefined}
                  onClick={() => setSelected(i)}
                >
                  {i === 0 ? 'Melhor time' : `Alternativa ${i}`} · nota {t.score.toFixed(1)}
                </button>
              ))}
            </div>
          )}

          {shown.members.length < TEAM_SIZE && (
            <p className="error">
              Só foi possível montar {shown.members.length} membros com as opções escolhidas. Tente
              aumentar as repetições de tipo ou desligar o equilíbrio de atacantes.
            </p>
          )}

          <div className="summary">
            {defenseGrade && (
              <GradeCard
                label="Defesa"
                result={defenseGrade}
                hint="Quantos tipos de ataque o time aguenta: cai quando há mais membros fracos do que resistentes."
              />
            )}
            {offense && (
              <GradeCard
                label="Ataque"
                result={offense.grade}
                hint="Quantos tipos o time acerta super efetivo com golpes fortes, com peso extra para STAB e para os tipos que ameaçam o time."
              />
            )}
            <div className="stat">
              <span>Fraquezas somadas</span>
              <strong>{analysis.weaknesses}</strong>
            </div>
            <div className="stat">
              <span>BST médio</span>
              <strong>{analysis.averageBst}</strong>
            </div>
            <div className="stat">
              <span>Composição</span>
              <strong className="composition">{describeCounts(countRoles(shown.members.map(classifyRole)))}</strong>
            </div>
            <div className="stat">
              <span>Lendários e afins</span>
              <strong>{analysis.legendaries}</strong>
            </div>
          </div>

          {game.approximateLearnsets && (
            <p className="footnote">
              A PokeAPI ainda não tem os golpes de {game.label}: as sugestões usam os learnsets
              dos jogos anteriores mais recentes.
            </p>
          )}
          {showItems && !itemsInGame && (
            <p className="footnote">{game.label} não tem held items, então não há sugestões de itens.</p>
          )}

          <h2>Time</h2>
          <div className="team-grid">
            {shown.members.map((member, i) => (
              <PokemonCard
                key={member.pokemon.id}
                member={member}
                isBase={i === 0}
                moves={movesets?.find((m) => m.pokemonId === member.pokemon.id)?.moves ?? null}
                item={items?.find((s) => s.pokemonId === member.pokemon.id) ?? null}
              />
            ))}
          </div>
          <p className="footnote">
            A habilidade destacada é a sugerida; em vermelho, habilidades que atrapalham. As
            bolinhas ao lado de um golpe mostram as fraquezas (do pokémon ou do time) que ele acerta
            super efetivo. Passe o mouse para ver detalhes.
          </p>

          <div className="coverage-grid">
            <section>
              <h2>Cobertura ofensiva</h2>
              {offense ? (
                <>
                  <dl className="type-groups">
                    <dt>Super efetivo pelo tipo dos pokémon (STAB)</dt>
                    <dd>
                      <TypeList types={offense.byStab} empty="Nenhum" />
                    </dd>
                    <dt>Super efetivo só pelos golpes de cobertura</dt>
                    <dd>
                      <TypeList types={offense.byMovesOnly} empty="Nenhum" />
                    </dd>
                    <dt>Sem nenhum golpe super efetivo</dt>
                    <dd>
                      <TypeList types={offense.uncovered} empty="Nenhum 🎉" />
                    </dd>
                  </dl>
                  <OffenseTable team={teamPokemon} offense={offense} />
                </>
              ) : (
                <p className="muted">Carregando golpes...</p>
              )}
            </section>

            <section>
              <h2>Defesa por tipo</h2>
              <dl className="type-groups">
                <dt>Tipos que ninguém do time resiste</dt>
                <dd>
                  <TypeList types={analysis.unresisted} empty="Nenhum 🎉" />
                </dd>
              </dl>
              <DefenseTable team={teamPokemon} analysis={analysis} />
            </section>
          </div>

          <p className="footnote">
            {result.candidateCount} tipagens candidatas avaliadas · dados da PokeAPI gerados em{' '}
            {new Date(dataset.generatedAt).toLocaleDateString('pt-BR')}
          </p>
        </section>
      )}
    </main>
  );
}
