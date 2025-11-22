
const ADDITION_STAGE_SEQUENCE = [
  {
    id: 'add-up-to-3',
    maxAddend: 3,
    minAddend: 0,
    prerequisites: [],
  },
  {
    id: 'add-up-to-5',
    maxAddend: 5,
    minAddend: 0,
    prerequisites: ['add-up-to-3'],
  },
];

const computeAdditionStageProgress = (masteryTracking = {}) => {
  const stages = [];
  ADDITION_STAGE_SEQUENCE.forEach((stageConfig, index) => {
    const { id, maxAddend, minAddend = 1, prerequisites = [] } = stageConfig;

    // Check prerequisites
    const prerequisitesMet = prerequisites.every((reqId) => {
      const prerequisiteStage = stages.find((entry) => entry.id === reqId);
      return prerequisiteStage?.mastered === true;
    });

    const unlocked = index === 0 ? true : prerequisitesMet;
    const addends = [];
    for (let value = minAddend; value <= maxAddend; value += 1) {
      addends.push(value);
    }

    // Simplified mastery check: assume nothing is mastered
    const mastered = false;

    stages.push({
      id,
      maxAddend,
      minAddend,
      addends,
      unlocked,
      mastered,
      prerequisitesMet,
    });
  });
  return stages;
};

// --- Reproduction Logic (WITH FIX) ---

const masteryTracking = {};
const additionStages = computeAdditionStageProgress(masteryTracking);

console.log("Stage 0-3 Unlocked:", additionStages.find(s => s.id === 'add-up-to-3').unlocked);
console.log("Stage 0-5 Unlocked:", additionStages.find(s => s.id === 'add-up-to-5').unlocked);

// Simulate stageMapByAddend from ModeSelection.jsx WITH FIX
const stageMapByAddend = new Map();
additionStages.forEach((stage) => {
  stage.addends.forEach((addend) => {
    if (!stageMapByAddend.has(addend)) { // THE FIX
        stageMapByAddend.set(addend, stage);
    }
  });
});

console.log("\n--- Checking Locks for specific numbers ---");

let allPassed = true;

[1, 3, 4].forEach(addend => {
    const stage = stageMapByAddend.get(addend);
    if (!stage) {
        console.log(`Addend ${addend}: No stage found`);
    } else {
        const locked = !stage.unlocked;
        const status = locked ? 'LOCKED' : 'UNLOCKED';
        console.log(`Addend ${addend}: Mapped to stage '${stage.id}' (Unlocked: ${stage.unlocked}) -> Status: ${status}`);

        if (addend <= 3 && locked) {
            console.error(`ERROR: Addend ${addend} should be UNLOCKED`);
            allPassed = false;
        }
        if (addend > 3 && !locked) {
            console.error(`ERROR: Addend ${addend} should be LOCKED`);
            allPassed = false;
        }
    }
});

if (allPassed) {
    console.log("\nSUCCESS: Verification passed.");
} else {
    console.error("\nFAILURE: Verification failed.");
    process.exit(1);
}
