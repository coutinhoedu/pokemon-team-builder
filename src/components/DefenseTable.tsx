import type { GamePokemon } from '../lib/data';
import type { TeamAnalysis } from '../lib/teamBuilder';
import { TypeBadge } from './TypeBadge';

const formatMultiplier = (m: number) => {
  if (m === 1) return '';
  if (m === 0.25) return '¼';
  if (m === 0.5) return '½';
  return `${m}×`;
};

const cellClass = (m: number) => {
  if (m === 0) return 'immune';
  if (m >= 4) return 'quad';
  if (m > 1) return 'weak';
  if (m < 1) return 'resist';
  return '';
};

/** Tabela "tipo de ataque × membro do time" com o multiplicador que cada um recebe. */
export function DefenseTable({ team, analysis }: { team: GamePokemon[]; analysis: TeamAnalysis }) {
  return (
    <div className="table-wrap">
      <table className="matrix-table">
        <thead>
          <tr>
            <th>Ataque</th>
            {team.map((p) => (
              <th key={p.id} title={p.displayName}>
                {p.sprite ? <img src={p.sprite} alt={p.displayName} width={40} height={40} /> : p.displayName}
              </th>
            ))}
            <th>Fracos</th>
            <th>Resistem</th>
          </tr>
        </thead>
        <tbody>
          {analysis.byType.map((row) => {
            const danger = row.weak > 0 && row.resist + row.immune === 0;
            return (
              <tr key={row.type} className={danger ? 'danger' : undefined}>
                <td>
                  <TypeBadge type={row.type} />
                </td>
                {row.multipliers.map((m, i) => (
                  <td key={team[i].id} className={`mult ${cellClass(m)}`}>
                    {formatMultiplier(m)}
                  </td>
                ))}
                <td className="count">{row.weak || ''}</td>
                <td className="count">{row.resist + row.immune || ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
