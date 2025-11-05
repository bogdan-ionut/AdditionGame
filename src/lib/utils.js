// src/lib/utils.js
import { ensurePersonalization } from './aiPersonalization';

export function withSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

export const createDefaultGameState = () => ({
  studentInfo: { name: null, age: null, gender: null },
  statistics: {
    problemHistory: {},
    answersTimeline: [],
    streak: 0,
    totalCorrect: 0,
    totalAnswered: 0,
  },
  aiPersonalization: ensurePersonalization(),
});

export const migrateGameState = (state) => {
  if (!state.aiPersonalization) {
    state.aiPersonalization = ensurePersonalization({}, state.studentInfo);
  } else {
    state.aiPersonalization = ensurePersonalization(state.aiPersonalization, state.studentInfo);
  }

  if (!state.statistics) {
    state.statistics = {
      problemHistory: {},
      answersTimeline: [],
      streak: 0,
      totalCorrect: 0,
      totalAnswered: 0,
    };
  }
  return state;
};
