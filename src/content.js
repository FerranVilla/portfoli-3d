// ─────────────────────────────────────────────────────────────────────────────
//  CONTINGUT DEL PORTFOLI — és l'únic fitxer que has d'editar.
//
//  · IDIOMES: qualsevol text pot ser una cadena (igual en català i anglès) o bé
//    { ca: 'Text en català', en: 'Text in English' }. Es canvia amb la tecla F.
//  · Els camps buits ('' o []) no es mostren: no cal esborrar-los.
//  · Els fitxers (imatges, PDF, ZIP…) van a la carpeta /public i s'hi fa
//    referència començant per '/'. Exemple: public/files/cv.pdf → '/files/cv.pdf'.
//  · Per a cada projecte, crea una carpeta public/projects/<id>/ amb les imatges.
// ─────────────────────────────────────────────────────────────────────────────

export const profile = {
  name: 'Ferran Villà',               // nom curt: cartell d'inici
  fullName: 'Ferran Villà i Alsina',  // nom complet: currículum i carta
  role: {
    ca: 'Desenvolupador multimèdia i de videojocs',
    en: 'Multimedia & Game Developer',
  },
  location: 'Barcelona',
  tagline: {
    ca: 'Un passeig pel bosc per conèixer-me. Fes fotos als animals que trobis.',
    en: 'A walk through the forest to get to know me. Photograph the animals you find.',
  },
  photo: '/img/foto-perfil.jpg',      // '' per no mostrar foto
  email: 'ferranvilla04@gmail.com',
  phone: '',                          // ex. '+34 600 000 000' (només surt al currículum)
  links: [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/ferran-villà-alsina-076120269' },
    { label: 'GitHub', url: 'https://github.com/el-teu-usuari' },
  ],
  // CV descarregable. Posa el PDF a public/files/ i escriu-ne la ruta (pot ser un PDF per idioma).
  cv: {
    file: '',                         // ex. '/files/cv-ferran-villa.pdf' o { ca: '/files/cv-ca.pdf', en: '/files/cv-en.pdf' }
    label: { ca: 'Descarrega el CV (PDF)', en: 'Download CV (PDF)' },
  },
};

// ── 01 · SOBRE MI (es mostra com un currículum)
// Pre-omplert amb Feina/FerranVillaCurrículum.pdf (setembre 2026). Revisa-ho i amplia-ho.
export const about = {
  marker: [ // el que es veu gravat a l'escorça
    'Ferran Villà i Alsina',
    { ca: 'Multimèdia · UVic-UCC', en: 'Multimedia · UVic-UCC' },
  ],
  summary: [
    {
      ca: 'Desenvolupador format en Multimèdia, Aplicacions i Videojocs, amb amplis coneixements en programació, tant de front-end com de back-end, i experiència en IoT, xarxes i desenvolupament de software. M\'apassiona crear experiències interactives, des del disseny fins a la programació.',
      en: 'Developer with a background in Multimedia, Applications and Video Games, with broad programming knowledge in both front-end and back-end, and experience in IoT, networking and software development. I love building interactive experiences, from design all the way to programming.',
    },
  ],
  experience: [
    {
      role: { ca: 'Muntatge i preparació de línies', en: 'Production line assembly and setup' },
      org: 'Casa Tarradellas',
      place: '',
      period: '',                     // ex. '2025 – 2026'
      description: {
        ca: 'Muntatge i preparació de línies de producció en torn nocturn.',
        en: 'Assembly and preparation of production lines on the night shift.',
      },
      highlights: [],                 // ex. [{ ca: '…', en: '…' }]
    },
    {
      role: { ca: 'Cambrer', en: 'Waiter' },
      org: 'Vienna Vic Centre',
      place: 'Vic',
      period: '',
      description: {
        ca: 'Atenció al client, presa de comandes, servei de taula i cobrament.',
        en: 'Customer service, taking orders, table service and handling payments.',
      },
      highlights: [],
    },
    {
      role: { ca: 'Cambrer de coctelera', en: 'Bartender' },
      org: 'Clot dels Romans',
      place: 'Barcelona',
      period: '',
      description: {
        ca: 'Preparació de còctels, atenció al detall, servei al client i manteniment de l\'ordre.',
        en: 'Cocktail preparation, attention to detail, customer service and keeping the bar in order.',
      },
      highlights: [],
    },
  ],
  education: [
    {
      title: { ca: 'Grau en Multimèdia, Aplicacions i Videojocs', en: 'BSc in Multimedia, Applications and Video Games' },
      org: 'UVic-UCC',
      period: '2023 – 2027',              // revisa l'any de finalització
      detail: '',
    },
    {
      title: { ca: 'Batxillerat Tecnològic', en: 'Baccalaureate in Technology' },
      org: 'Jesuïtes del Clot',
      period: '2023',
      detail: '',
    },
  ],
  skills: [
    {
      group: { ca: 'Especialitats', en: 'Specialities' },
      items: [
        { ca: 'Programació full-stack', en: 'Full-stack development' },
        { ca: 'Modelatge i animació 3D', en: '3D modelling and animation' },
        { ca: 'IoT i xarxes', en: 'IoT and networking' },
        { ca: 'Desenvolupament web', en: 'Web development' },
      ],
    },
    { group: { ca: 'Llenguatges', en: 'Languages' }, items: ['C', 'C++', 'C#', 'TypeScript', 'JavaScript', 'Swift', 'Kotlin', 'SQL', 'HTML', 'CSS'] },
    { group: 'Frameworks', items: ['Vue', 'React', 'Angular'] },
    { group: { ca: 'Eines', en: 'Tools' }, items: ['Unity', 'Unreal Engine', 'Blender', 'three.js'] }, // revisa-ho
  ],
  languages: [
    { name: { ca: 'Català', en: 'Catalan' }, level: { ca: 'Natiu', en: 'Native' }, value: 1 },
    { name: { ca: 'Castellà', en: 'Spanish' }, level: { ca: 'Natiu', en: 'Native' }, value: 1 },
    { name: { ca: 'Anglès', en: 'English' }, level: { ca: 'Alt', en: 'Advanced' }, value: 0.8 },
  ],
  // Seccions lliures opcionals (certificats, premis, voluntariat, interessos…)
  extra: [
    // { title: { ca: 'Certificats', en: 'Certificates' }, items: ['Nom del certificat — Entitat, 2025'] },
  ],
};

// ── 02 · PROJECTES
// Cada projecte té una targeta a la graella i una fitxa completa quan hi fas clic.
// Imatges: public/projects/<id>/cover.jpg (16:9, ~1600×900) i les que vulguis a `gallery`.
// Descàrregues: posa els fitxers a public/projects/<id>/ i afegeix-los a `downloads`.
// ITCH.IO: posa l'enllaç a `itch` i executa `npm run itch`. Es baixen sols la portada, les captures
// i el tràiler, i si el joc té build web es pot jugar dins del portfoli («Juga ara»).
export const projectsIntro = {
  ca: 'Una selecció de treballs de la carrera i personals.',
  en: 'A selection of university and personal work.',
};
// Targeta final de la graella («Projectes en procés»). Posa-la a false per amagar-la.
export const projectsUpcoming = true;
export const projects = [
  {
    id: 'last-memory',
    title: 'Last Memory',
    year: { ca: 'Març 2026', en: 'March 2026' },
    role: '',                            // ex. { ca: 'Programació i disseny', en: 'Programming and design' }
    context: '',                         // ex. { ca: 'Treball de fi de grau', en: 'Final degree project' }
    summary: {
      ca: 'Terror psicològic en realitat virtual, ambientat en un poble durant la Guerra Civil.',
      en: 'A VR psychological horror game set in a Spanish village during the Civil War.',
    },
    description: [
      {
        ca: 'Un joc de terror psicològic en realitat virtual ambientat en un poble durant la Guerra Civil espanyola. Els soldats enemics, reimaginats com a zombis terrorífics, intenten impedir que tornis a casa mentre recorres el poble i descobreixes els records d\'un veterà de guerra.',
        en: 'A VR psychological horror game set in a Spanish village during the Civil War. As enemy soldiers, reimagined as terrifying zombies, try to prevent you from getting home, you must navigate the village while uncovering the memories of a war veteran.',
      },
      {
        ca: 'L\'objectiu és crear una experiència tensa i immersiva que explori els efectes psicològics de la guerra i l\'estrès posttraumàtic.',
        en: 'The game aims to create a tense and immersive experience while exploring the psychological effects of war and PTSD.',
      },
    ],
    tags: ['Unity', 'VR', 'C#'],          // revisa-ho
    itch: 'https://ferranvilla.itch.io/last-memory',
    trailer: '',                         // ja es fa servir el vídeo de Vimeo de la pàgina d'itch.io
    cover: '',
    gallery: [],
    links: [],
    downloads: [],
  },
  {
    id: 'conerace',
    title: 'ConeRace',
    year: { ca: 'Setembre 2025', en: 'September 2025' },
    role: '',                            // ex. { ca: 'Disseny i programació', en: 'Design and programming' }
    context: { ca: 'El meu primer videojoc en 3D', en: 'My first 3D game' },
    summary: {
      ca: 'Curses per a dos jugadors: qui recull abans els cons repartits pel mapa?',
      en: 'A two-player race: who can collect the cones scattered around the map first?',
    },
    description: [
      {
        ca: 'Competeix contra un amic per ser el més ràpid recollint els cons repartits pel mapa. És el meu primer videojoc en 3D.',
        en: 'Compete with a friend to be the fastest at collecting the cones scattered around the map. This is my first ever 3D video game.',
      },
    ],
    tags: [{ ca: 'Multijugador local', en: 'Local multiplayer' }, { ca: 'Curses', en: 'Racing' }], // afegeix-hi el motor (Unity…)
    itch: 'https://ferranvilla.itch.io/conerace',
    trailer: '',                         // ja es fa servir el vídeo de Vimeo de la pàgina d'itch.io
    cover: '',
    gallery: [],
    links: [],
    downloads: [],
  },
];

// ── 03 · CARTA DE PRESENTACIÓ (es mostra com una carta formal)
export const letter = {
  marker: [{ ca: 'Qui sóc', en: 'Who I am' }], // el que es veu reflectit a l'aigua (clicable: obre la carta)
  place: 'Barcelona',
  date: '',                               // ex. { ca: 'octubre de 2026', en: 'October 2026' } ('' = data d'avui)
  greeting: { ca: 'Hola,', en: 'Hello,' },
  paragraphs: [
    {
      ca: 'Si has arribat fins aquí, gràcies per fer el camí. Sóc en Ferran Villà, desenvolupador format en Multimèdia, Aplicacions i Videojocs a la UVic-UCC, i aquesta carta és la meva manera de dir-te qui sóc més enllà del currículum.',
      en: 'If you have made it this far, thank you for walking the trail. I\'m Ferran Villà, a developer trained in Multimedia, Applications and Video Games at UVic-UCC, and this letter is my way of telling you who I am beyond my CV.',
    },
    {
      ca: 'El que de veritat m\'apassiona és crear. Del món dels videojocs, el que més m\'atrau és entendre com funcionen per dins: pensar una mecànica, dissenyar-la i programar-la fins que se sent bé a les mans. Gaudeixo tant de la part de disseny com de la tècnica, i m\'agrada especialment el moment en què totes dues es troben. Aquest mateix portfoli n\'és un exemple.',
      en: 'What truly drives me is creating. In video games, what draws me in most is understanding how they work from the inside: coming up with a mechanic, designing it and programming it until it feels right. I enjoy the design side as much as the technical one, and I especially love the moment where both meet. This very portfolio is an example of that.',
    },
    {
      ca: 'Fora de la pantalla, sóc una persona oberta i extrovertida. Faig muntanya i fotografia, dues aficions que m\'han ensenyat a tenir paciència i a fixar-me en els detalls, i he tingut la sort de viatjar i conèixer altres llocs i maneres de fer. Vinc d\'una família gran, i potser per això em sento còmode treballant en equip, escoltant i aportant.',
      en: 'Away from the screen, I\'m an open and outgoing person. I love mountaineering and photography, two hobbies that have taught me patience and an eye for detail, and I\'ve been lucky enough to travel and discover other places and ways of doing things. I come from a big family, which is perhaps why I feel at home working in a team, listening and contributing.',
    },
    {
      ca: 'Vull formar part d\'un equip que faci coses amb cura i ganes, on pugui aportar el que sé i seguir creixent. Si creus que puc encaixar en el vostre, m\'encantaria parlar-ne.',
      en: 'I want to be part of a team that builds things with care and enthusiasm, where I can contribute what I know and keep growing. If you think I could be a good fit for yours, I would love to talk.',
    },
  ],
  closing: { ca: 'Una abraçada,', en: 'Warm regards,' },
  signature: '',                          // imatge de la signatura, ex. '/img/signatura.png' (fons transparent)
  pdf: '',                                // ex. '/files/carta-ferran-villa.pdf' o { ca: '…', en: '…' }
};

// ── Les parades del sender (animal, espècie i títol). No cal tocar-les.
export const stops = [
  { id: 'about', animal: 'stag', species: { ca: 'Cérvol', en: 'Red deer' }, latin: 'Cervus elaphus', title: { ca: 'Sobre mi', en: 'About me' } },
  { id: 'projects', animal: 'hawk', species: { ca: 'Aligot', en: 'Buzzard' }, latin: 'Buteo buteo', title: { ca: 'Projectes', en: 'Projects' } },
  { id: 'letter', animal: 'wolf', species: { ca: 'Llop', en: 'Wolf' }, latin: 'Canis lupus', title: { ca: 'Carta de presentació', en: 'Cover letter' } },
];
