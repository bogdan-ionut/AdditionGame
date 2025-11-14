import { predictSuccess } from '../../../lib/aiPersonalization';

export const sanitizeInterestList = (values = []) => {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .filter((value) => {
      const lower = value.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    })
    .slice(0, 12);
};

export const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const extractOperandsFromPlanItem = (item) => {
  if (!item || typeof item !== 'object') {
    return { a: null, b: null };
  }
  const direct = Array.isArray(item.operands) && item.operands.length >= 2
    ? item.operands
    : Array.isArray(item.problem?.operands) && item.problem.operands.length >= 2
      ? item.problem.operands
      : null;
  if (direct) {
    const a = toNumber(direct[0]);
    const b = toNumber(direct[1]);
    return { a, b };
  }
  const aCandidates = [
    item.a,
    item.left,
    item.lhs,
    item.first,
    item.x,
    item?.problem?.a,
    item?.problem?.left,
  ];
  const bCandidates = [
    item.b,
    item.right,
    item.rhs,
    item.second,
    item.y,
    item?.problem?.b,
    item?.problem?.right,
  ];
  const a = aCandidates.map(toNumber).find((value) => value != null) ?? null;
  const b = bCandidates.map(toNumber).find((value) => value != null) ?? null;
  return { a, b };
};

export const buildMasterySnapshot = (mastery = {}) => {
  const snapshot = {};
  let total = 0;
  let count = 0;
  Object.entries(mastery || {}).forEach(([key, node]) => {
    const predicted = predictSuccess(node);
    if (typeof predicted === 'number' && Number.isFinite(predicted)) {
      const clamped = Math.max(0, Math.min(1, Number(predicted.toFixed(3))));
      snapshot[key] = clamped;
      total += clamped;
      count += 1;
    }
  });
  if (count > 0) {
    snapshot.add_within_10 = Number((total / count).toFixed(3));
  }
  return snapshot;
};

export const resolveLearnerGrade = (student = {}) => {
  if (student && typeof student.grade === 'string') {
    const trimmed = student.grade.trim();
    if (trimmed) return trimmed;
  }
  const age = typeof student?.age === 'number' ? student.age : Number(student?.age);
  if (!Number.isFinite(age)) return 'preK';
  if (age < 5) return 'preK';
  if (age < 6) return 'K';
  if (age < 7) return 'grade-1';
  if (age < 8) return 'grade-2';
  if (age < 9) return 'grade-3';
  return 'grade-4';
};

export const resolveNarrationLocale = (code) => {
  if (!code || typeof code !== 'string') return 'en-US';
  const normalized = code.replace(/_/g, '-').trim();
  if (!normalized) return 'en-US';
  const lower = normalized.toLowerCase();
  if (lower === 'ro') return 'ro-RO';
  if (lower === 'en') return 'en-US';
  if (lower.length === 2) {
    return `${lower}-${lower.toUpperCase()}`;
  }
  return normalized;
};

export const describeSpriteUrl = (url = '') => {
  if (typeof url !== 'string') return '';
  try {
    const trimmed = url.split('?')[0];
    const parts = trimmed.split('/');
    const last = parts[parts.length - 1] || '';
    const base = last.replace(/\.png$/i, '').replace(/[_-]+/g, ' ').trim();
    if (base) {
      return base.length > 60 ? `${base.slice(0, 57)}…` : base;
    }
  } catch (error) {
    // Ignore parsing issues
  }
  return 'motiv de personaj';
};
