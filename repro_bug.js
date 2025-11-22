
import { computeAdditionStageProgress, ADDITION_STAGE_SEQUENCE } from './src/modules/addition/state/stages.js';

// Mock mastery tracking (empty, new user)
const masteryTracking = {};
// Initialize for 0-9
for (let i = 0; i <= 9; i++) {
    masteryTracking[i] = { level: 'not-started', totalAttempts: 0, correctAttempts: 0 };
}

// Compute stages
const additionStages = computeAdditionStageProgress(masteryTracking, {});

// Simulate stageMapByAddend from ModeSelection.jsx
const stageMapByAddend = new Map();
additionStages.forEach((stage) => {
  stage.addends.forEach((addend) => {
    stageMapByAddend.set(addend, stage);
  });
});

// Check if 1 is locked
const checkAddend = (addend) => {
    const stage = stageMapByAddend.get(addend);
    if (!stage) return { locked: false, status: 'no-stage' };

    // In ModeSelection, we check stage.unlocked.
    // Also we check prerequisite stages.

    // But getLockInfo logic:
    // if (stage.unlocked) return { locked: false }

    return {
        addend,
        stageId: stage.id,
        unlocked: stage.unlocked,
        locked: !stage.unlocked
    };
};

console.log("Stage 1 (0-3) unlocked:", additionStages.find(s => s.id === 'add-up-to-3').unlocked);
console.log("Stage 2 (0-5) unlocked:", additionStages.find(s => s.id === 'add-up-to-5').unlocked);

console.log("Checking addend 1:");
console.log(checkAddend(1));

console.log("Checking addend 3:");
console.log(checkAddend(3));

console.log("Checking addend 4:");
console.log(checkAddend(4));
