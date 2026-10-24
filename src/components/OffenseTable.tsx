import type { OffenseAnalysis } from '../lib/coverage';
import type { GamePokemon } from '../lib/data';
import { TypeBadge } from './TypeBadge';

const formatMultiplier = (m: number) => (m === 1 ? '' : m === 0.5 ? '½' : `${m}×`);

const cellClass = (m: number) => (m > 1 ? 'good' : m === 0 ? 'none' : m < 1 ? 'bad' : '');

/** Tabela "tipo defensor × membro": o melhor multiplicador que cada um causa com seus golpes. */
export function OffenseTable({ team, offense }: { team: GamePokemon[]; offense: OffenseAnalysis }) {
  return (
    <div className="table-wrap">
      <table className="matrix-table">
        <thead>
          <tr>
            <th>Alvo</th>
            {team.map((p) => (
              <th key={p.id} title={p.displayName}>
                {p.sprite ? <img src={p.sprite} alt={p.displayName} width={40} height={40} /> : p.displayName}
              </th>
            ))}
            <th title="Membros que acertam super efetivo">SE</th>
          </tr>
        </thead>
        <tbody>
          {offense.rows.map((row) => (
            <tr key={row.type} className={row.hitters === 0 ? 'danger' : undefined}>
              <td>
                <TypeBadge type={row.type} />
              </td>
              {row.cells.map((cell, i) => (
                <td
                  key={team[i].id}
                  className={`mult ${cellClass(cell.multiplier)}${cell.stab && cell.multiplier > 1 ? ' stab' : ''}`}
                  title={cell.source ? `${cell.source}${cell.stab ? ' (STAB)' : ''}` : undefined}
                >
                  {formatMultiplier(cell.multiplier)}
                </td>
              ))}
              <td className="count">{row.hitters || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
