export type ScoreTier = 'danger' | 'warning' | 'muted';

export function scoreTier(score: number): ScoreTier {
  if (score >= 80) return 'danger';
  if (score >= 50) return 'warning';
  return 'muted';
}

export function tierBadgeClasses(tier: ScoreTier): string {
  switch (tier) {
    case 'danger':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'warning':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}
