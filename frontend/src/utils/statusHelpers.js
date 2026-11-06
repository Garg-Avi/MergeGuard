export const TRUST_STATUSES = {
  ESTABLISHED: {
    key: 'ESTABLISHED',
    label: 'Trusted',
    description: 'Verified history of accepted contributions and peer recommendations.',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  NEWCOMER: {
    key: 'NEWCOMER',
    label: 'New',
    description: 'First-time contributor. Welcomed with an open baseline; never assumed suspicious.',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dotClass: 'bg-indigo-500',
  },
  'INSUFFICIENT EVIDENCE': {
    key: 'INSUFFICIENT EVIDENCE',
    label: 'Building Reputation',
    description: 'Contributions observed, still gathering peer recommendations and evidence.',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
  },
  'UNDER REVIEW': {
    key: 'UNDER REVIEW',
    label: 'Needs Review',
    description: 'Flagged for maintainer review due to conflicting signals or pending reports.',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
  },
};

export function getTrustStatusInfo(rawState) {
  if (!rawState) return TRUST_STATUSES.NEWCOMER;
  const upper = String(rawState).trim().toUpperCase();
  if (upper === 'ESTABLISHED' || upper === 'TRUSTED') return TRUST_STATUSES.ESTABLISHED;
  if (upper === 'NEWCOMER' || upper === 'NEW') return TRUST_STATUSES.NEWCOMER;
  if (
    upper === 'INSUFFICIENT EVIDENCE' ||
    upper === 'INSUFFICIENT_EVIDENCE' ||
    upper === 'BUILDING REPUTATION' ||
    upper === 'BUILDING_REPUTATION'
  ) {
    return TRUST_STATUSES['INSUFFICIENT EVIDENCE'];
  }
  if (
    upper === 'UNDER REVIEW' ||
    upper === 'UNDER_REVIEW' ||
    upper === 'NEEDS REVIEW' ||
    upper === 'NEEDS_REVIEW'
  ) {
    return TRUST_STATUSES['UNDER REVIEW'];
  }
  return {
    key: rawState,
    label: rawState,
    description: 'Status evaluated under repository policies.',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
  };
}

