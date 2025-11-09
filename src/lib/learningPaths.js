export const OPERATIONS = {
  addition: {
    id: 'addition',
    label: 'Addition Adventures',
    description: 'Foundations in counting, composing numbers, and automaticity with addition facts.',
    focusAges: 'Ages 3-9',
    icon: 'plus',
    palette: 'from-sky-500/10 via-sky-400/10 to-indigo-500/10',
    highlight: 'Build confident early mathematicians with joyful practice.',
  },
  subtraction: {
    id: 'subtraction',
    label: 'Subtraction Stories',
    description: 'Take away, compare, and reason about differences using manipulatives and number lines.',
    focusAges: 'Ages 5-10',
    icon: 'minus',
    palette: 'from-amber-500/10 via-orange-400/10 to-red-500/10',
    highlight: 'Ground subtraction in meaningful contexts before racing to fluency.',
  },
  multiplication: {
    id: 'multiplication',
    label: 'Multiplication Missions',
    description: 'Skip-counting, equal groups, and area models that prepare learners for long multiplication.',
    focusAges: 'Ages 7-12',
    icon: 'x',
    palette: 'from-emerald-500/10 via-teal-400/10 to-cyan-500/10',
    highlight: 'Unlock pattern-based reasoning and fact fluency for bigger adventures.',
  },
  division: {
    id: 'division',
    label: 'Division Discoveries',
    description: 'Share and partition with confidence using quotients, remainders, and visual reasoning.',
    focusAges: 'Ages 8-14',
    icon: 'divide',
    palette: 'from-purple-500/10 via-fuchsia-400/10 to-pink-500/10',
    highlight: 'Connect division to multiplication mastery and story-driven problem solving.',
  },
};

export const LEARNING_PATH_STATUS = {
  available: {
    label: 'Available',
    cta: 'Start Path',
    tone: 'emerald',
    message: 'Fully playable with adaptive practice and reporting.',
  },
  'in-beta': {
    label: 'Beta',
    cta: 'Join Beta',
    tone: 'amber',
    message: 'Early preview with limited guardians invited soon.',
  },
  'in-design': {
    label: 'In Design',
    cta: 'Roadmap',
    tone: 'indigo',
    message: 'Storyboards, manipulatives, and scaffolds are being drafted.',
  },
  'coming-soon': {
    label: 'Coming Soon',
    cta: 'Preview',
    tone: 'slate',
    message: 'Sign up to be notified as soon as this path is ready.',
  },
  research: {
    label: 'In Research',
    cta: 'Preview',
    tone: 'sky',
    message: 'Piloting with educators—follow along as we shape the experience.',
  },
};

export const LEARNING_PATHS = [
  {
    id: 'addition-within-10',
    moduleKey: 'addition-within-10',
    operation: 'addition',
    title: 'Addition • 0-9 Sums',
    description: 'Countable objects, fact fluency, and AI-personalized stories for early learners.',
    status: 'available',
    recommendedAges: 'Ages 3-6',
    badges: ['Adaptive Practice', 'AI Story Mode', 'Parent Dashboard'],
    learningObjectives: [
      'Compose numbers within 10 using objects, fingers, and number lines.',
      'Move from counting-all to counting-on strategies with scaffolded hints.',
      'Earn mastery badges with spaced review, streaks, and joyful celebrations.',
    ],
    milestones: [
      {
        title: 'Stage 1 · Counting Explorer',
        detail: 'Introduce sums within 5, matching objects to numerals and tracing number lines.',
      },
      {
        title: 'Stage 2 · Fact Detective',
        detail: 'Tackle all single-digit facts with adaptive playlists and AI-generated mini stories.',
      },
      {
        title: 'Stage 3 · Mastery Sprint',
        detail: 'Automatic recall with checkpoints, streak coaching, and parent dashboards.',
      },
    ],
    previewContent: 'Live today with the Addition Flashcards experience, mastery tracking, exports, and AI planning.',
  },
  {
    id: 'addition-within-100',
    moduleKey: null,
    operation: 'addition',
    title: 'Addition • 0-100 Explorer',
    description: 'Two-digit addition with regrouping using base-ten blocks, open number lines, and strategy cards.',
    status: 'in-design',
    recommendedAges: 'Ages 6-8',
    badges: ['Regrouping Stories', 'Strategy Cards', 'Printable Practice'],
    learningObjectives: [
      'Build place-value understanding with tens and ones manipulatives.',
      'Explore multiple solution paths including partial sums and open number lines.',
      'Transition from concrete models to abstract reasoning with friendly numbers.',
    ],
    milestones: [
      {
        title: 'Stage 1 · Place Value Builders',
        detail: 'Compose and decompose two-digit numbers with animated base-ten blocks.',
      },
      {
        title: 'Stage 2 · Regrouping Lab',
        detail: 'Practice regrouping through puzzles, estimation challenges, and AI hints.',
      },
      {
        title: 'Stage 3 · Speed & Strategy Mix',
        detail: 'Timed quests blend strategy choice with fluency sprints for deeper mastery.',
      },
    ],
    previewContent: 'Storyboard complete. Interactive prototypes launch soon for select classrooms and parents.',
  },
  {
    id: 'addition-beyond-100',
    moduleKey: null,
    operation: 'addition',
    title: 'Addition • 100+ Power Ups',
    description: 'Large-number addition, multi-step problems, and mental math challenges for confident learners.',
    status: 'coming-soon',
    recommendedAges: 'Ages 8-12',
    badges: ['Mental Math Labs', 'Word Problem Studio', 'Timed Challenges'],
    learningObjectives: [
      'Strengthen estimation and rounding to plan solution paths before calculating.',
      'Solve multi-step addition problems tied to real-world scenarios and STEM themes.',
      'Cultivate mental math strategies with friendly numbers and decompositions.',
    ],
    milestones: [
      {
        title: 'Stage 1 · Estimation Arcade',
        detail: 'Gamified estimation with number lines and magnitude comparisons.',
      },
      {
        title: 'Stage 2 · Algorithm Architect',
        detail: 'Column addition, lattice methods, and calculator comparisons to build flexibility.',
      },
      {
        title: 'Stage 3 · Real-World Labs',
        detail: 'Project-based quests blending budgets, science experiments, and storytelling.',
      },
    ],
    previewContent: 'Narrative arcs and challenge libraries are being written—look for educator preview later this year.',
  },
  {
    id: 'subtraction-within-20',
    moduleKey: null,
    operation: 'subtraction',
    title: 'Subtraction • Within 20 Stories',
    description: 'Connect subtraction to counting back, comparison, and missing addend thinking.',
    status: 'in-design',
    recommendedAges: 'Ages 5-8',
    badges: ['Story Problems', 'Number Line Hops', 'Fact Families'],
    learningObjectives: [
      'Use concrete manipulatives and number lines to act out take-away stories.',
      'Link subtraction to addition with fact-family triangles and missing addends.',
      'Develop flexible strategies like counting up and decomposing teen numbers.',
    ],
    milestones: [
      {
        title: 'Stage 1 · Story Explorers',
        detail: 'Interactive picture-book scenes scaffold removal and comparison situations.',
      },
      {
        title: 'Stage 2 · Strategy Switchers',
        detail: 'Students choose strategies while AI coaches suggest alternatives.',
      },
      {
        title: 'Stage 3 · Fact Family Jam',
        detail: 'Fluency checks and games reinforce connections between operations.',
      },
    ],
    previewContent: 'Designing manipulatives and narrative flows. Educator co-design workshops scheduled for next sprint.',
  },
  {
    id: 'multiplication-fundamentals',
    moduleKey: null,
    operation: 'multiplication',
    title: 'Multiplication • Fundamentals Lab',
    description: 'Skip-counting, arrays, and equal groups accelerate fact mastery.',
    status: 'research',
    recommendedAges: 'Ages 7-11',
    badges: ['Array Playground', 'Fact Fluency Grid', 'STEM Challenges'],
    learningObjectives: [
      'Transition from repeated addition to structured arrays and equal groups.',
      'Develop fact fluency with adaptive games, songs, and pattern spotting.',
      'Apply multiplication to STEM scenarios like area, scaling, and data displays.',
    ],
    milestones: [
      {
        title: 'Stage 1 · Pattern Detectives',
        detail: 'Skip-counting adventures and rhythm-based memorization tools.',
      },
      {
        title: 'Stage 2 · Array Architects',
        detail: 'Virtual manipulatives and tile boards build conceptual understanding.',
      },
      {
        title: 'Stage 3 · Fact Hero Quests',
        detail: 'Boss battles and tournaments reinforce accuracy and speed.',
      },
    ],
    previewContent: 'Teacher research interviews underway. Pilot classrooms will receive printable missions first.',
  },
  {
    id: 'division-quest',
    moduleKey: null,
    operation: 'division',
    title: 'Division • Quest for Quotients',
    description: 'Fair-sharing stories, remainders, and multi-step challenges for upper elementary learners.',
    status: 'coming-soon',
    recommendedAges: 'Ages 8-14',
    badges: ['Sharing Stories', 'Remainder Lab', 'Mixed Operation Missions'],
    learningObjectives: [
      'Model division with equal groups, arrays, and measurement contexts.',
      'Link division and multiplication facts through fact-family explorations.',
      'Tackle division with remainders and interpret results in real stories.',
    ],
    milestones: [
      {
        title: 'Stage 1 · Sharing Stories',
        detail: 'Animated characters divide collections using drag-and-drop manipulatives.',
      },
      {
        title: 'Stage 2 · Remainder Lab',
        detail: 'Interactive labs surface when to round up, stay whole, or express fractions.',
      },
      {
        title: 'Stage 3 · Mission Control',
        detail: 'Mixed-operation quests blend multiplication, division, and problem-solving.',
      },
    ],
    previewContent: 'Quest map under construction with narrative writers and curriculum advisors.',
  },
];

export const groupPathsByOperation = (paths = []) => {
  return paths.reduce((acc, path) => {
    if (!acc[path.operation]) acc[path.operation] = [];
    acc[path.operation].push(path);
    return acc;
  }, {});
};

export const findLearningPath = (id) => LEARNING_PATHS.find((path) => path.id === id);
