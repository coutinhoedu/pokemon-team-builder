import type { GradeResult } from '../lib/coverage';

export function GradeCard({ label, result, hint }: { label: string; result: GradeResult; hint: string }) {
  return (
    <div className={`grade-card grade-${result.grade}`} title={hint}>
      <span className="grade-letter">{result.grade}</span>
      <span className="grade-text">
        <strong>{label}</strong>
        <span>{result.score}/100</span>
      </span>
    </div>
  );
}
