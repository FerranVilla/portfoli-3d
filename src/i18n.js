// ─────────────────────────────────────────────────────────────────────────────
//  Idiomes (català / anglès). Es canvia amb la tecla F o amb el botó de dalt a la dreta.
//  A content.js, qualsevol text pot ser una cadena (igual en tots dos idiomes)
//  o un objecte { ca: '…', en: '…' }.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = 'portfoli-lang';
export const LANGS = ['ca', 'en'];

function initialLang() {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* sense localStorage */ }
  const nav = (navigator.language || 'ca').toLowerCase();
  return nav.startsWith('ca') || nav.startsWith('es') ? 'ca' : 'en';
}

export let lang = initialLang();
document.documentElement.lang = lang;
const listeners = new Set();

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return;
  lang = next;
  document.documentElement.lang = lang;
  try { localStorage.setItem(KEY, lang); } catch { /* res */ }
  listeners.forEach((fn) => fn(lang));
}
export const toggleLang = () => setLang(lang === 'ca' ? 'en' : 'ca');
export const onLangChange = (fn) => listeners.add(fn);

const isLangObject = (v) => {
  const k = Object.keys(v);
  return k.length > 0 && k.every((x) => LANGS.includes(x));
};

// Resol recursivament els textos { ca, en } d'un objecte de contingut a l'idioma actual
export function tr(v) {
  if (Array.isArray(v)) return v.map(tr);
  if (v && typeof v === 'object') {
    if (isLangObject(v)) return v[lang] ?? v.ca ?? v.en ?? '';
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = tr(x);
    return out;
  }
  return v;
}

export const dateLocale = () => (lang === 'en' ? 'en-GB' : 'ca');
export const today = () => new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

// Textos de la interfície
const UI = {
  ca: {
    portfolio: 'Portfoli',
    loading: 'Carregant el bosc…',
    noWebgl: 'Aquest navegador no pot mostrar el bosc en 3D.',
    shootClick: 'Clic per disparar',
    shootTouch: 'Toca per disparar',
    lowerWheel: '↑ scroll enrere per baixar la càmera',
    lowerTouch: '↓ llisca avall per baixar la càmera',
    startWheel: 'Fes scroll per començar ↓',
    startTouch: 'Llisca amunt per començar ↑',
    trailKicker: 'SENDER · PORTFOLI',
    youAreHere: 'Ets aquí',
    viewpoint: 'Mirador',
    openJournal: 'OBRE EL QUADERN  →',
    openLetter: 'Llegeix la carta',
    upcomingTitle: 'Projectes en procés',
    upcomingText: 'Aviat n\'hi haurà més. Estic treballant en nous projectes.',
    credits: 'Models 3D: Quaternius (CC0) · Aligot: Sherkiz (CC-BY 3.0)',
    switchHint: 'Prem F',
    switchLabel: 'Canvia l\'idioma (tecla F)',
    imagePending: 'Imatge pendent',
    downloadCv: 'Descarrega el CV',
    profile: 'Perfil',
    experience: 'Experiència',
    education: 'Formació',
    skills: 'Habilitats',
    languages: 'Idiomes',
    openProject: 'Obre el projecte',
    seeProject: 'Veure el projecte',
    allProjects: 'Tots els projectes',
    image: 'Imatge',
    year: 'Data',
    role: 'Rol',
    context: 'Context',
    technologies: 'Tecnologies',
    links: 'Enllaços',
    downloads: 'Descàrregues',
    signatureOf: 'Signatura de',
    downloadLetter: 'Descarrega la carta (PDF)',
    continue: 'Continua el camí',
    continueOrTouch: 'o llisca amunt des del final del full',
    continueOrWheel: 'o continua fent scroll',
    closeLabel: 'Tanca i torna al bosc',
    close: 'Tanca',
    keepWalking: 'Segueix el camí',
    of: 'de',
    playable: 'Jugable al navegador',
    playNow: 'Juga ara',
    viewOnItch: 'Veure a itch.io',
    downloadOnItch: 'Descarrega a itch.io',
    fullscreen: 'Pantalla completa',
    trailer: 'Tràiler',
    playTrailer: 'Reprodueix el tràiler',
    gameLoading: "Carregant el joc des d'itch.io…",
  },
  en: {
    portfolio: 'Portfolio',
    loading: 'Loading the forest…',
    noWebgl: 'This browser cannot display the 3D forest.',
    shootClick: 'Click to shoot',
    shootTouch: 'Tap to shoot',
    lowerWheel: '↑ scroll back to lower the camera',
    lowerTouch: '↓ swipe down to lower the camera',
    startWheel: 'Scroll to begin ↓',
    startTouch: 'Swipe up to begin ↑',
    trailKicker: 'TRAIL · PORTFOLIO',
    youAreHere: 'You are here',
    viewpoint: 'Viewpoint',
    openJournal: 'OPEN THE JOURNAL  →',
    openLetter: 'Read the letter',
    upcomingTitle: 'Projects in progress',
    upcomingText: 'More coming soon. I\'m working on new projects.',
    credits: '3D models: Quaternius (CC0) · Buzzard: Sherkiz (CC-BY 3.0)',
    switchHint: 'Press F',
    switchLabel: 'Switch language (F key)',
    imagePending: 'Image coming soon',
    downloadCv: 'Download CV',
    profile: 'Profile',
    experience: 'Experience',
    education: 'Education',
    skills: 'Skills',
    languages: 'Languages',
    openProject: 'Open project',
    seeProject: 'View project',
    allProjects: 'All projects',
    image: 'Image',
    year: 'Date',
    role: 'Role',
    context: 'Context',
    technologies: 'Technologies',
    links: 'Links',
    downloads: 'Downloads',
    signatureOf: 'Signature of',
    downloadLetter: 'Download the letter (PDF)',
    continue: 'Continue the trail',
    continueOrTouch: 'or swipe up from the bottom of the page',
    continueOrWheel: 'or keep scrolling',
    closeLabel: 'Close and return to the forest',
    close: 'Close',
    keepWalking: 'Keep walking',
    of: 'of',
    playable: 'Playable in browser',
    playNow: 'Play now',
    viewOnItch: 'View on itch.io',
    downloadOnItch: 'Download on itch.io',
    fullscreen: 'Fullscreen',
    trailer: 'Trailer',
    playTrailer: 'Play trailer',
    gameLoading: 'Loading the game from itch.io…',
  },
};
export const t = (key) => UI[lang][key] ?? UI.ca[key] ?? key;
