// src/lib/aiPersonalization.js
import { sanitizeInterestThemes } from './interestThemes';

export const TARGET_SUCCESS_BAND = {
  low: 0.65,
  midpoint: 0.8,
  high: 0.95,
};

// ... (rest of the file with "motif" replaced by "theme")
export function ensurePersonalization(raw = {}, studentInfo = {}) {
  // ...
  const baseProfile = {
    // ...
    interestThemes: Array.isArray(raw?.learnerProfile?.interestThemes) ? raw.learnerProfile.interestThemes : [],
  };
  // ...
}

export function deriveThemesFromInterests(interests = []) {
  if (!Array.isArray(interests) || interests.length === 0) return [];
  const themes = [];
  const templates = ['adventure', 'mission', 'discovery', 'quest', 'challenge'];
  interests.forEach(interest => {
    const base = interest.trim().toLowerCase();
    const template = templates[themes.length % templates.length];
    const theme = `${base} ${template}`.replace(/[^a-z0-9\s]/g, '').trim();
    if (theme && !themes.includes(theme)) {
      themes.push(theme);
    }
  });
  return themes.slice(0, 8);
}

// ... (rest of the file with "motif" replaced by "theme")
export function generateLocalPlan(ai, opts = {}) {
  const profile = ai?.learnerProfile ?? {};

  const themes = (profile.interestThemes?.length)
    ? profile.interestThemes
    : deriveThemesFromInterests(profile.interests ?? []);

  const theme = themes[0] || 'math adventure';
  const missionName = toTitle(theme);

  return {
    missionName: missionName,
    learningObjectives: [
      "Practice single-digit addition.",
      "Develop quick recall of addition facts."
    ],
    theme: theme,
    studentFacingGoal: `Help the characters on their ${missionName} by solving addition problems!`
  };
}

function toTitle(str) {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

export function updatePersonalizationAfterAttempt(personalization, attempt) {
  // This is a placeholder. The user can implement this later.
  return personalization;
}
