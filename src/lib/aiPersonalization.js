// src/lib/aiPersonalization.js
import { sanitizeInterestThemes } from './interestThemes';

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
function generateLocalPlan(
  //...
  const themes = ai.learnerProfile.interestThemes?.length
    ? ai.learnerProfile.interestThemes
    : deriveThemesFromInterests(ai.learnerProfile.interests);
  const theme = themes[0] || (themeName ? themeName.toLowerCase() : 'math adventure');
  const missionName = themeName || toTitle(theme);
  //...
)
