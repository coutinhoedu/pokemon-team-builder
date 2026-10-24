import type { TypeName } from '../lib/typeChart';
import { TYPE_COLORS, TYPE_LABELS } from '../lib/typeInfo';

export function TypeBadge({ type, small = false }: { type: TypeName; small?: boolean }) {
  return (
    <span className={`type-badge${small ? ' small' : ''}`} style={{ backgroundColor: TYPE_COLORS[type] }}>
      {TYPE_LABELS[type]}
    </span>
  );
}

/** Bolinha colorida do tipo, para listas compactas (o nome aparece no tooltip). */
export function TypeDot({ type }: { type: TypeName }) {
  return (
    <span
      className="type-dot"
      style={{ backgroundColor: TYPE_COLORS[type] }}
      title={TYPE_LABELS[type]}
      aria-label={TYPE_LABELS[type]}
    />
  );
}
