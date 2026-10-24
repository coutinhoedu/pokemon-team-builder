import { BALANCE_STYLES, ROLE_LABELS, type BalanceStyle, type Role } from '../lib/roles';

const ICONS: Record<BalanceStyle, string> = {
  auto: '✨',
  offensive: '⚔️',
  balanced: '⚖️',
  defensive: '🛡️',
};

const ROLE_ORDER: Role[] = ['physical', 'special', 'mixed', 'tank'];

/** As 6 bolinhas da composição; no automático as duas últimas vagas ficam "em aberto". */
function compositionDots(style: BalanceStyle): (Role | 'flex')[] {
  if (style === 'auto') return ['physical', 'physical', 'special', 'special', 'flex', 'flex'];
  const [counts] = BALANCE_STYLES[style].compositions;
  return ROLE_ORDER.flatMap((role) => Array<Role>(counts[role]).fill(role));
}

interface Props {
  value: BalanceStyle;
  onChange: (style: BalanceStyle) => void;
}

export function BalanceStylePicker({ value, onChange }: Props) {
  const styles = Object.keys(BALANCE_STYLES) as BalanceStyle[];

  return (
    <div className="balance-picker">
      <div className="balance-options" role="radiogroup" aria-label="Estilo do time">
        {styles.map((style) => {
          const info = BALANCE_STYLES[style];
          return (
            <label key={style} className={`balance-option${value === style ? ' selected' : ''}`}>
              <input
                type="radio"
                name="balance-style"
                value={style}
                checked={value === style}
                onChange={() => onChange(style)}
              />
              <span className="balance-icon" aria-hidden="true">
                {ICONS[style]}
              </span>
              <span className="balance-label">{info.label}</span>
              <span className="balance-description">{info.description}</span>
              <span className="role-dots" aria-hidden="true">
                {compositionDots(style).map((role, i) => (
                  <span key={i} className={`role-dot ${role === 'flex' ? 'flex' : `role-${role}`}`} />
                ))}
              </span>
            </label>
          );
        })}
      </div>
      <div className="role-legend" aria-hidden="true">
        {ROLE_ORDER.map((role) => (
          <span key={role}>
            <span className={`role-dot role-${role}`} /> {ROLE_LABELS[role]}
          </span>
        ))}
        <span>
          <span className="role-dot flex" /> Misto ou tank
        </span>
      </div>
    </div>
  );
}
