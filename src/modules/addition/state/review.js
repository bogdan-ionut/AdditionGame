export const REVIEW_INTERVALS = [
  10 * 60 * 1000,
  60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];

export const scheduleReview = (needsReview, a, b) => {
  const key = `${a}+${b}`;
  const now = Date.now();
  const index = needsReview.findIndex((p) => p.key === key);

  if (index !== -1) {
    const updated = [...needsReview];
    const existing = { ...updated[index] };
    const nextStage = Math.min((existing.stage || 0) + 1, REVIEW_INTERVALS.length - 1);
    existing.stage = nextStage;
    existing.dueAt = now + REVIEW_INTERVALS[nextStage];
    updated[index] = existing;
    return updated;
  }

  return [...needsReview, { key, a, b, stage: 0, dueAt: now + REVIEW_INTERVALS[0] }];
};

export const pickReviewDue = (adaptiveLearning) => {
  const now = Date.now();
  const queue = adaptiveLearning?.needsReview || [];
  const due = queue.filter((p) => p.dueAt <= now);
  const remaining = queue.filter((p) => p.dueAt > now);
  const reviewCards = due.map(({ a, b }) => ({ a, b, answer: a + b, review: true }));
  return { reviewCards, remaining };
};
