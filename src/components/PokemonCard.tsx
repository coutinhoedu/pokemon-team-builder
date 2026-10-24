import type { CSSProperties } from 'react';
import { isHarmful } from '../lib/abilities';
import type { TeamMember } from '../lib/data';
import { itemSprite, type ItemSuggestion } from '../lib/items';
import { classifyRole, ROLE_LABELS } from '../lib/roles';
import type { SuggestedMove } from '../lib/movesets';
import { TYPE_COLORS, TYPE_LABELS } from '../lib/typeInfo';
import { TypeBadge, TypeDot } from './TypeBadge';

const SUB_LEGENDARY_LABELS = { 'ultra-beast': 'Ultra Beast', paradox: 'Paradox' };

interface Props {
  member: TeamMember;
  isBase: boolean;
  moves: SuggestedMove[] | null; // null enquanto os golpes do jogo carregam
  item: ItemSuggestion | null; // null quando a sugestão de itens está desligada
}

export function PokemonCard({ member, isBase, moves, item }: Props) {
  const { pokemon, ability: suggested } = member;
  const role = classifyRole(member);
  const [primary, secondary = primary] = pokemon.types;
  // As cores dos tipos pintam o topo do card.
  const typeColors = { '--t1': TYPE_COLORS[primary], '--t2': TYPE_COLORS[secondary] } as CSSProperties;

  return (
    <article className={`pokemon-card${isBase ? ' is-base' : ''}`} style={typeColors}>
      <div className="card-top">
        <div className="tags">
          {isBase && <span className="tag">Base</span>}
          {pokemon.legendary && <span className="tag warn">Lendário</span>}
          {pokemon.mythical && <span className="tag warn">Mítico</span>}
          {pokemon.subLegendary && <span className="tag warn">{SUB_LEGENDARY_LABELS[pokemon.subLegendary]}</span>}
        </div>
        {pokemon.sprite ? (
          <img src={pokemon.sprite} alt="" width={96} height={96} loading="lazy" />
        ) : (
          <div className="sprite-placeholder" />
        )}
      </div>

      <h3>{pokemon.displayName}</h3>
      <span className={`role role-${role}`}>{ROLE_LABELS[role]}</span>
      <div className="types">
        {pokemon.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>
      <p className="stats">
        <span>BST {pokemon.bst}</span>
        <span>Atk {pokemon.atk}</span>
        <span>SpA {pokemon.spa}</span>
      </p>

      {pokemon.abilities.length > 0 && (
        <ul className="abilities">
          {pokemon.abilities.map((ability) => {
            const classes = [
              ability.id === suggested?.id ? 'suggested' : '',
              isHarmful(ability) ? 'harmful' : '',
            ].join(' ');
            return (
              <li key={ability.id} className={classes} title={ability.description}>
                {ability.id === suggested?.id && <span aria-label="sugerida">★ </span>}
                {ability.name}
                {ability.hidden && <span className="hidden-tag">oculta</span>}
              </li>
            );
          })}
        </ul>
      )}

      {item && (
        <div className={`held-item${item.item ? '' : ' none'}`} title={item.reason}>
          {item.item ? (
            <>
              <img src={itemSprite(item.item.id)} alt="" width={30} height={30} loading="lazy" />
              <span>
                <strong>{item.item.name}</strong>
                <small>{item.reason}</small>
              </span>
            </>
          ) : (
            <span>
              <strong>Sem item</strong>
              <small>{item.reason}</small>
            </span>
          )}
        </div>
      )}

      {moves && (
        <ul className="moves">
          {moves.length === 0 && <li className="empty">Sem golpes de dano nos dados deste jogo</li>}
          {moves.map((move) => (
            <li
              key={move.id}
              title={
                move.counters.length > 0
                  ? `Super efetivo contra fraquezas: ${move.counters.map((t) => TYPE_LABELS[t]).join(', ')}`
                  : undefined
              }
            >
              <TypeBadge type={move.type} small />
              <span className="move-name">
                {move.name}
                {move.stab && <span className="stab">STAB</span>}
              </span>
              <span className="move-meta">
                {move.power}
                {move.hits > 1 ? `×${move.hits}` : ''} · {move.category === 'physical' ? 'Físico' : 'Especial'}
                {move.counters.map((t) => (
                  <TypeDot key={t} type={t} />
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
