export const TRUST_STATUSES = {
  ESTABLISHED: {
    key: 'ESTABLISHED',
    label: 'Trusted',
    description: 'Verified history of accepted contributions and peer recommendations.',
    badgeClass: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40',
    dotClass: 'bg-emerald-400',
  },
  NEWCOMER: {
    key: 'NEWCOMER',
    label: 'New',
    description: 'First-time contributor. Welcomed with an open baseline; never assumed suspicious.',
    badgeClass: 'bg-[#202329] text-[#B0B3BA] border-[#2B2E35]',
    dotClass: 'bg-[#777D87]',
  },
  'INSUFFICIENT EVIDENCE': {
    key: 'INSUFFICIENT EVIDENCE',
    label: 'Building Reputation',
    description: 'Contributions observed, still gathering peer recommendations and evidence.',
    badgeClass: 'bg-[#202329] text-[#B0B3BA] border-[#2B2E35]',
    dotClass: 'bg-[#777D87]',
  },
  'UNDER REVIEW': {
    key: 'UNDER REVIEW',
    label: 'Needs Review',
    description: 'Flagged for maintainer review due to conflicting signals or pending reports.',
    badgeClass: 'bg-amber-950/40 text-[#D69B45] border-amber-800/40',
    dotClass: 'bg-[#D69B45]',
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
    badgeClass: 'bg-[#202329] text-[#B0B3BA] border-[#2B2E35]',
    dotClass: 'bg-[#777D87]',
  };
}

