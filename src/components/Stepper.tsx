import { useId } from 'react';

interface Props {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

/** Campo numérico com botões − e +, sempre limitado entre min e max. */
export function Stepper({ label, hint, value, min, max, onChange }: Props) {
  const id = useId();
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div className="stepper">
      <label htmlFor={id}>{label}</label>
      <div className="stepper-control">
        <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Diminuir">
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const parsed = Number.parseInt(e.target.value, 10);
            onChange(Number.isNaN(parsed) ? min : clamp(parsed));
          }}
        />
        <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="Aumentar">
          +
        </button>
      </div>
      {hint && <small>{hint}</small>}
    </div>
  );
}
