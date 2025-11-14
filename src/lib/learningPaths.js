export const OPERATIONS = {
  addition: {
    id: 'addition',
    label: 'Aventuri de Adunare',
    description: 'Fundamente de numărat, compunerea numerelor și automatizarea faptelor de adunare.',
    focusAges: 'Vârste 3-9',
    icon: 'plus',
    palette: 'from-sky-500/10 via-sky-400/10 to-indigo-500/10',
    highlight: 'Construiește încrederea micilor matematicieni prin exerciții pline de bucurie.',
  },
  subtraction: {
    id: 'subtraction',
    label: 'Povești cu Scădere',
    description: 'Îndepărtează, compară și argumentează diferențele folosind materiale concrete și drepte numerice.',
    focusAges: 'Vârste 5-10',
    icon: 'minus',
    palette: 'from-amber-500/10 via-orange-400/10 to-red-500/10',
    highlight: 'Așază scăderea în contexte relevante înainte de a urmări viteza.',
  },
  multiplication: {
    id: 'multiplication',
    label: 'Misiuni de Înmulțire',
    description: 'Numărat în pași, grupuri egale și modele de arie care pregătesc elevii pentru înmulțiri lungi.',
    focusAges: 'Vârste 7-12',
    icon: 'x',
    palette: 'from-emerald-500/10 via-teal-400/10 to-cyan-500/10',
    highlight: 'Dezvăluie raționamentul bazat pe tipare și fluența faptelor pentru aventuri mai mari.',
  },
  division: {
    id: 'division',
    label: 'Descoperiri cu Împărțirea',
    description: 'Împarte cu încredere folosind câturi, resturi și raționament vizual.',
    focusAges: 'Vârste 8-14',
    icon: 'divide',
    palette: 'from-purple-500/10 via-fuchsia-400/10 to-pink-500/10',
    highlight: 'Conectează împărțirea la stăpânirea înmulțirii și la rezolvarea de probleme cu povești.',
  },
};

export const LEARNING_PATH_STATUS = {
  available: {
    label: 'Disponibil',
    cta: 'Pornește traseul',
    tone: 'emerald',
    message: 'Complet jucabil, cu exerciții adaptive și rapoarte dedicate.',
  },
  'in-beta': {
    label: 'Beta',
    cta: 'Alătură-te beta',
    tone: 'amber',
    message: 'Previzualizare timpurie, curând cu invitații pentru câțiva părinți.',
  },
  'in-design': {
    label: 'În proiectare',
    cta: 'Planificare',
    tone: 'indigo',
    message: 'Lucrăm la storyboard-uri, materiale concrete și suporturi de învățare.',
  },
  'coming-soon': {
    label: 'În curând',
    cta: 'Previzualizare',
    tone: 'slate',
    message: 'Înscrie-te ca să fii anunțat imediat ce traseul este gata.',
  },
  research: {
    label: 'În testare',
    cta: 'Previzualizare',
    tone: 'sky',
    message: 'Pilotăm împreună cu cadre didactice—urmărește cum conturăm experiența.',
  },
};

export const LEARNING_PATHS = [
  {
    id: 'addition-within-10',
    moduleKey: 'addition-within-10',
    operation: 'addition',
    title: 'Adunare • Sume 0-9',
    description: 'Obiecte de numărat, fluență la adunare și povești personalizate de AI pentru începători.',
    status: 'available',
    recommendedAges: 'Vârste 3-6',
    badges: ['Exerciții adaptive', 'Mod povești AI', 'Tablou de bord pentru părinți'],
    learningObjectives: [
      'Compune numere până la 10 folosind obiecte, degete și drepte numerice.',
      'Treci de la număratul complet la număratul continuu cu indicii ghidate.',
      'Câștigă insigne de stăpânire cu recapitulări eșalonate, serii și sărbători vesele.',
    ],
    milestones: [
      {
        title: 'Etapa 1 · Explorator al Numărării',
        detail: 'Introdu sumele până la 5, potrivind obiecte cu cifre și urmărind drepte numerice.',
      },
      {
        title: 'Etapa 2 · Detectivul Faptelor',
        detail: 'Abordează toate faptele cu o singură cifră cu liste adaptive și mini-povești generate de AI.',
      },
      {
        title: 'Etapa 3 · Sprintul Stăpânirii',
        detail: 'Rechemare automată cu puncte de control, antrenor pentru serii și tablouri pentru părinți.',
      },
    ],
    previewContent: 'Disponibil astăzi cu exerciții de tip flashcards, urmărirea progresului, exporturi și planificare AI.',
  },
  {
    id: 'addition-within-100',
    moduleKey: null,
    operation: 'addition',
    title: 'Adunare • Explorator 0-100',
    description: 'Adunare cu două cifre și regrupare folosind cuburi zecimale, drepte numerice și carduri de strategie.',
    status: 'in-design',
    recommendedAges: 'Vârste 6-8',
    badges: ['Povești despre regrupare', 'Carduri de strategie', 'Fișe tipărite'],
    learningObjectives: [
      'Construiește înțelegerea valorii poziționale cu materiale pentru zeci și unități.',
      'Explorează mai multe căi de rezolvare, inclusiv sume parțiale și drepte numerice deschise.',
      'Treci de la modele concrete la raționament abstract cu numere prietenoase.',
    ],
    milestones: [
      {
        title: 'Etapa 1 · Constructorii Valorii Poziționale',
        detail: 'Compune și descompune numere cu două cifre cu blocuri animate zecimale.',
      },
      {
        title: 'Etapa 2 · Laboratorul Regrupării',
        detail: 'Exersează regruparea prin puzzle-uri, provocări de estimare și indicii AI.',
      },
      {
        title: 'Etapa 3 · Mix de Viteză și Strategie',
        detail: 'Misiuni cronometrate care combină alegerea strategiei cu sprinturi de fluență pentru stăpânire deplină.',
      },
    ],
    previewContent: 'Storyboard-ul este gata. Protoptipurile interactive sosesc curând pentru clase și părinți selectați.',
  },
  {
    id: 'addition-beyond-100',
    moduleKey: null,
    operation: 'addition',
    title: 'Adunare • Power-up 100+',
    description: 'Adunări cu numere mari, probleme cu mai mulți pași și provocări de calcul mental pentru învățăcei siguri pe ei.',
    status: 'coming-soon',
    recommendedAges: 'Vârste 8-12',
    badges: ['Laboratoare de calcul mental', 'Studio de probleme', 'Provocări cronometrate'],
    learningObjectives: [
      'Întărește estimarea și rotunjirea pentru a planifica soluția înainte de calcul.',
      'Rezolvă probleme de adunare cu mai mulți pași legate de scenarii reale și teme STEM.',
      'Dezvoltă strategii de calcul mental cu numere prietenoase și descompuneri.',
    ],
    milestones: [
      {
        title: 'Etapa 1 · Arcade de Estimare',
        detail: 'Estimare gamificată cu drepte numerice și comparații de mărime.',
      },
      {
        title: 'Etapa 2 · Arhitectul Algoritmului',
        detail: 'Adunare în coloană, metode cu rețea și comparații cu calculatorul pentru flexibilitate.',
      },
      {
        title: 'Etapa 3 · Laboratoare din Lumea Reală',
        detail: 'Misiuni bazate pe proiecte ce combină bugete, experimente științifice și narațiune.',
      },
    ],
    previewContent: 'Scriem arcuri narative și biblioteci de provocări—previzualizări pentru profesori mai târziu în acest an.',
  },
  {
    id: 'subtraction-within-20',
    moduleKey: null,
    operation: 'subtraction',
    title: 'Scădere • Povești până la 20',
    description: 'Leagă scăderea de număratul invers, comparație și identificarea termenului lipsă.',
    status: 'in-design',
    recommendedAges: 'Vârste 5-8',
    badges: ['Probleme-poveste', 'Salturi pe dreapta numerică', 'Familii de operații'],
    learningObjectives: [
      'Folosește materiale concrete și drepte numerice pentru a juca povești de tip „iau deoparte”.',
      'Leagă scăderea de adunare cu triunghiuri ale familiilor de operații și termeni lipsă.',
      'Dezvoltă strategii flexibile precum număratul în sus și descompunerea numerelor 10-19.',
    ],
    milestones: [
      {
        title: 'Etapa 1 · Exploratorii Poveștilor',
        detail: 'Scene interactive ca în cărți ilustrate susțin situații de eliminare și comparație.',
      },
      {
        title: 'Etapa 2 · Schimbătorii de Strategie',
        detail: 'Copiii aleg strategii în timp ce antrenorul AI propune alternative.',
      },
      {
        title: 'Etapa 3 · Jam-ul Familiilor de Operații',
        detail: 'Jocuri și verificări de fluență întăresc legătura dintre operații.',
      },
    ],
    previewContent: 'Concepem materiale concrete și fluxuri narative. Atelierele cu profesori sunt programate pentru sprintul următor.',
  },
  {
    id: 'multiplication-fundamentals',
    moduleKey: null,
    operation: 'multiplication',
    title: 'Înmulțire • Laboratorul Fundamentelor',
    description: 'Număratul în pași, matricile și grupurile egale accelerează stăpânirea faptelor.',
    status: 'research',
    recommendedAges: 'Vârste 7-11',
    badges: ['Terenul matricilor', 'Grila fluenței', 'Provocări STEM'],
    learningObjectives: [
      'Treci de la adunări repetate la matrici structurate și grupuri egale.',
      'Dezvoltă fluența faptelor cu jocuri adaptive, cântece și descoperirea tiparelor.',
      'Aplică înmulțirea în scenarii STEM precum arii, scalări și reprezentări de date.',
    ],
    milestones: [
      {
        title: 'Etapa 1 · Detectivi ai Tiparelor',
        detail: 'Aventuri cu numărat în pași și instrumente de memorare pe ritm.',
      },
      {
        title: 'Etapa 2 · Arhitecții Matricilor',
        detail: 'Materiale virtuale și plăci cu dale dezvoltă înțelegerea conceptuală.',
      },
      {
        title: 'Etapa 3 · Misiunile Eroilor Faptelor',
        detail: 'Lupte cu „șefi” și turnee care întăresc precizia și viteza.',
      },
    ],
    previewContent: 'Interviurile cu profesori sunt în desfășurare. Clasele pilot vor primi primele misiuni tipăribile.',
  },
  {
    id: 'division-quest',
    moduleKey: null,
    operation: 'division',
    title: 'Împărțire • Vânătoarea de Câturi',
    description: 'Povești despre împărțire dreaptă, resturi și provocări în mai mulți pași pentru elevii mari din primar.',
    status: 'coming-soon',
    recommendedAges: 'Vârste 8-14',
    badges: ['Povești despre împărțire', 'Laboratorul resturilor', 'Misiuni cu operații mixte'],
    learningObjectives: [
      'Modelează împărțirea cu grupuri egale, matrici și contexte de măsurare.',
      'Leagă împărțirea de înmulțire prin explorarea familiilor de operații.',
      'Abordează împărțirea cu rest și interpretează rezultatele în povești reale.',
    ],
    milestones: [
      {
        title: 'Etapa 1 · Povești de Împărțire',
        detail: 'Personaje animate împart colecții folosind materiale drag-and-drop.',
      },
      {
        title: 'Etapa 2 · Laboratorul Resturilor',
        detail: 'Laboratoare interactive arată când să rotunjești în sus, să rămâi pe întregi sau să exprimi fracții.',
      },
      {
        title: 'Etapa 3 · Centrul de Misiuni',
        detail: 'Misiuni cu operații mixte ce combină înmulțirea, împărțirea și rezolvarea de probleme.',
      },
    ],
    previewContent: 'Harta misiunilor este în construcție împreună cu scenariști și consilieri educaționali.',
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
