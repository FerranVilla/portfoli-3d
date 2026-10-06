import * as C from './content.js';
import { tr, t, today } from './i18n.js';
import ITCH from './itch-data.json';

// id d'un vídeo de YouTube a partir d'un enllaç (o l'id mateix)
const ytId = (v = '') => v.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/)?.[1] || (/^[A-Za-z0-9_-]{11}$/.test(v) ? v : '');
const vimeoId = (v = '') => v.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1] || '';

// Vídeo (YouTube o Vimeo) a partir d'un enllaç escrit a mà o de la importació d'itch.io
function videoRef(v) {
  if (!v) return null;
  if (typeof v === 'object') return v.id ? v : null;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(v)) return { provider: 'file', id: v };
  if (vimeoId(v)) return { provider: 'vimeo', id: vimeoId(v) };
  if (ytId(v)) return { provider: 'youtube', id: ytId(v) };
  return null;
}
const videoEmbed = (v) => (v.provider === 'file' ? `file:${v.id}` : v.provider === 'vimeo'
  ? `https://player.vimeo.com/video/${v.id}` // igual que a itch.io: sense paràmetres (amb paràmetres, el reproductor fallava)
  : `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1`);

// Combina el que has escrit a content.js amb el que s'ha importat d'itch.io (el teu text mana)
function withItch(p) {
  const d = ITCH[p.id] || {};
  const manual = videoRef(p.trailer);
  const trailer = manual || videoRef(d.trailer);
  const itchUrl = p.itch || d.url || '';
  return {
    ...p,
    cover: p.cover || d.cover || '',
    gallery: p.gallery?.length ? p.gallery : d.screenshots || [],
    trailer,
    trailerThumb: (manual ? '' : d.trailerThumb) || (trailer?.provider === 'youtube' ? `https://img.youtube.com/vi/${trailer.id}/hqdefault.jpg` : ''),
    play: p.play === false ? null : d.play || null,
    itchUrl,
  };
}

// Contingut ja resolt a l'idioma actual
const L = () => ({
  profile: tr(C.profile), about: tr(C.about), projects: tr(C.projects).map(withItch),
  projectsIntro: tr(C.projectsIntro), letter: tr(C.letter), stops: tr(C.stops),
});

// ─────────────────────────────────────────────────────────────────────────────
//  El quadern de camp: quan fas una foto, la còpia revelada va a parar al costat
//  d'un full amb tota la informació de la parada. Es tanca fent scroll fins al
//  final (i una mica més), amb «Continua el camí», amb la creu o amb Esc.
// ─────────────────────────────────────────────────────────────────────────────

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const has = (v) => (Array.isArray(v) ? v.length > 0 : !!v);
const ext = (file = '') => (file.split('?')[0].split('.').pop() || '').toUpperCase();
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
  expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m3 7 9 6 9-6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5 9 4l1 4-2 1.3a12 12 0 0 0 6.7 6.7L16 14l4 1 .5 2.4a2 2 0 0 1-2 2.1A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2.1-2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m0 0-5-5m5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m0 0 5-5m-5 5 5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// ── Peces comunes
function sectionHead(index, title) {
  return `<p class="jr-kicker"><span>${String(index + 1).padStart(2, '0')}</span>${esc(title)}</p>`;
}

function contactRow({ withPhone = false } = {}) {
  const { profile } = L();
  const items = [];
  if (profile.location) items.push(`<li>${ICON.pin}<span>${esc(profile.location)}</span></li>`);
  if (profile.email) items.push(`<li>${ICON.mail}<a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a></li>`);
  if (withPhone && profile.phone) items.push(`<li>${ICON.phone}<a href="tel:${esc(profile.phone.replace(/\s/g, ''))}">${esc(profile.phone)}</a></li>`);
  for (const l of profile.links || []) {
    if (l.url) items.push(`<li>${ICON.link}<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`);
  }
  return items.length ? `<ul class="jr-contact">${items.join('')}</ul>` : '';
}

function downloadItem({ label, file, size }) {
  if (!file) return '';
  const type = ext(file);
  return `<li><a class="jr-download" href="${esc(file)}" download>
      <span class="jr-download-icon">${ICON.download}</span>
      <span class="jr-download-text"><strong>${esc(label || file.split('/').pop())}</strong>
      <small>${[type, size].filter(Boolean).map(esc).join(' · ')}</small></span>
    </a></li>`;
}

function imageOrPlaceholder(src, title, cls = '') {
  if (src) return `<img class="${cls}" src="${esc(src)}" alt="${esc(title)}" loading="lazy" decoding="async">`;
  const initials = title.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return `<div class="jr-placeholder ${cls}" role="img" aria-label="${esc(title)}"><span>${esc(initials)}</span><small>${esc(t('imagePending'))}</small></div>`;
}

// ── 01 · Sobre mi: currículum
function aboutHTML(index) {
  const { profile, about, stops } = L();
  const exp = (about.experience || []).map((e) => `
    <li class="jr-entry">
      <div class="jr-entry-head">
        <h4>${esc(e.role)}</h4>
        ${e.period ? `<span class="jr-period">${esc(e.period)}</span>` : ''}
      </div>
      <p class="jr-entry-org">${esc([e.org, e.place].filter(Boolean).join(' · '))}</p>
      ${e.description ? `<p>${esc(e.description)}</p>` : ''}
      ${has(e.highlights) ? `<ul class="jr-bullets">${e.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
    </li>`).join('');
  const edu = (about.education || []).map((e) => `
    <li class="jr-entry">
      <div class="jr-entry-head"><h4>${esc(e.title)}</h4>${e.period ? `<span class="jr-period">${esc(e.period)}</span>` : ''}</div>
      <p class="jr-entry-org">${esc([e.org, e.detail].filter(Boolean).join(' · '))}</p>
    </li>`).join('');
  const skills = (about.skills || []).map((g) => `
    <div class="jr-skill-group"><h5>${esc(g.group)}</h5>
      <ul class="jr-chips">${g.items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>`).join('');
  const langs = (about.languages || []).map((l) => `
    <li><span class="jr-lang-name">${esc(l.name)}</span><span class="jr-lang-level">${esc(l.level)}</span>
      <span class="jr-meter" aria-hidden="true"><i style="width:${Math.round((l.value ?? 0.5) * 100)}%"></i></span></li>`).join('');
  const extra = (about.extra || []).map((x) => cvSection(x.title, Array.isArray(x.items)
    ? `<ul class="jr-bullets">${x.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
    : `<p>${esc(x.text || '')}</p>`)).join('');

  return `
    ${sectionHead(index, stops[index].title)}
    <header class="jr-cv-head">
      ${profile.photo ? `<img class="jr-avatar" src="${esc(profile.photo)}" alt="${esc(profile.fullName || profile.name)}">` : ''}
      <div>
        <h2 id="jr-title">${esc(profile.fullName || profile.name)}</h2>
        <p class="jr-role">${esc(profile.role)}</p>
        ${contactRow({ withPhone: true })}
      </div>
    </header>
    ${profile.cv?.file ? `<div class="jr-actions"><a class="jr-btn" href="${esc(profile.cv.file)}" download>${ICON.download}<span>${esc(profile.cv.label || t('downloadCv'))}</span></a></div>` : ''}
    ${has(about.summary) ? cvSection(t('profile'), about.summary.map((p) => `<p class="jr-lead">${esc(p)}</p>`).join('')) : ''}
    ${exp ? cvSection(t('experience'), `<ol class="jr-timeline">${exp}</ol>`) : ''}
    ${edu ? cvSection(t('education'), `<ol class="jr-timeline">${edu}</ol>`) : ''}
    ${skills ? cvSection(t('skills'), `<div class="jr-skills">${skills}</div>`) : ''}
    ${langs ? cvSection(t('languages'), `<ul class="jr-langs">${langs}</ul>`) : ''}
    ${extra}`;
}

function cvSection(label, body) {
  return `<section class="jr-cv-section"><h3>${esc(label)}</h3><div class="jr-cv-body">${body}</div></section>`;
}

// ── 02 · Projectes: graella i fitxa
function projectsHTML(index) {
  const { projects, projectsIntro, stops } = L();
  const cards = projects.map((p, i) => `
    <li><button class="jr-card" data-project="${i}" aria-label="${esc(t('openProject'))}: ${esc(p.title)}">
      <span class="jr-card-media">${imageOrPlaceholder(p.cover || p.trailerThumb, p.title)}
        ${p.play ? `<span class="jr-badge">${ICON.play}${esc(t('playable'))}</span>` : ''}</span>
      <span class="jr-card-body">
        <span class="jr-card-meta">${esc([p.year, p.context].filter(Boolean).join(' · '))}</span>
        <span class="jr-card-title">${esc(p.title)}</span>
        <span class="jr-card-summary">${esc(p.summary)}</span>
        ${has(p.tags) ? `<span class="jr-tags">${p.tags.slice(0, 4).map((t) => `<span>${esc(t)}</span>`).join('')}</span>` : ''}
        <span class="jr-card-more">${esc(t('seeProject'))} ${ICON.arrow}</span>
      </span>
    </button></li>`).join('');
  return `
    ${sectionHead(index, stops[index].title)}
    <h2 id="jr-title">${esc(stops[index].title)}</h2>
    ${projectsIntro ? `<p class="jr-lead">${esc(projectsIntro)}</p>` : ''}
    <ul class="jr-grid">${cards}${C.projectsUpcoming ? `
      <li><div class="jr-card jr-card-upcoming" aria-label="${esc(t('upcomingTitle'))}">
        <span class="jr-upcoming-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="jr-card-title">${esc(t('upcomingTitle'))}</span>
        <span class="jr-card-summary">${esc(t('upcomingText'))}</span>
      </div></li>` : ''}</ul>`;
}

function mediaItems(p) {
  const items = [];
  if (p.trailer) items.push({ kind: 'video', embed: videoEmbed(p.trailer), thumb: p.trailerThumb || (p.trailer.provider === 'file' ? p.cover : '') });
  for (const src of [p.cover, ...(p.gallery || [])].filter(Boolean)) {
    if (!items.some((it) => it.src === src)) items.push({ kind: 'img', src });
  }
  return items;
}

function mediaMain(item, title) {
  if (!item) return imageOrPlaceholder('', title);
  if (item.kind === 'img') return `<img src="${esc(item.src)}" alt="${esc(title)}">`;
  return `<button class="jr-video" data-video="${esc(item.embed)}" aria-label="${esc(t('playTrailer'))}">
      ${item.thumb ? `<img src="${esc(item.thumb)}" alt="">` : ''}<span class="jr-video-play">${ICON.play}</span>
      <span class="jr-video-label">${esc(t('trailer'))}</span></button>`;
}

function projectDetailHTML(i) {
  const p = L().projects[i];
  const media = mediaItems(p);
  const actions = [
    p.play && `<button class="jr-btn jr-btn-dark" data-play="${i}">${ICON.play}<span>${esc(t('playNow'))}</span></button>`,
    p.itchUrl && `<a class="jr-btn" href="${esc(p.itchUrl)}" target="_blank" rel="noopener"><span>${esc(t(p.play ? 'viewOnItch' : 'downloadOnItch'))}</span>${ICON.external}</a>`,
  ].filter(Boolean).join('');
  const meta = [[t('year'), p.year], [t('role'), p.role], [t('context'), p.context]].filter(([, v]) => v);
  return `
    <button class="jr-back" data-back>${ICON.back}<span>${esc(t('allProjects'))}</span></button>
    <h2 id="jr-title">${esc(p.title)}</h2>
    ${p.summary ? `<p class="jr-lead">${esc(p.summary)}</p>` : ''}
    ${actions ? `<div class="jr-actions">${actions}</div>` : ''}
    <div class="jr-gallery">
      <div class="jr-gallery-main">${mediaMain(media[0], p.title)}</div>
      ${media.length > 1 ? `<div class="jr-thumbs">${media.map((m, k) => `
        <button class="jr-thumb${k === 0 ? ' is-active' : ''}${m.kind === 'video' ? ' is-video' : ''}" data-media="${k}"
          aria-label="${esc(m.kind === 'video' ? t('trailer') : `${t('image')} ${k + 1}`)}">
          ${m.kind === 'video' && !m.thumb ? '<span class="jr-thumb-dark"></span>' : `<img src="${esc(m.kind === 'video' ? m.thumb : m.src)}" alt="" loading="lazy">`}${m.kind === 'video' ? ICON.play : ''}</button>`).join('')}</div>` : ''}
    </div>
    ${meta.length ? `<dl class="jr-meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${has(p.description) ? `<div class="jr-prose">${p.description.map((d) => `<p>${esc(d)}</p>`).join('')}</div>` : ''}
    ${has(p.tags) ? cvSection(t('technologies'), `<ul class="jr-chips">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`) : ''}
    ${has(p.links) ? cvSection(t('links'), `<ul class="jr-links">${p.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ${ICON.external}</a></li>`).join('')}</ul>`) : ''}
    ${has(p.downloads) ? cvSection(t('downloads'), `<ul class="jr-downloads">${p.downloads.map(downloadItem).join('')}</ul>`) : ''}`;
}

// ── 03 · Carta de presentació
function letterHTML(index) {
  const { profile, letter, stops } = L();
  const name = profile.fullName || profile.name;
  return `
    ${sectionHead(index, stops[index].title)}
    <div class="jr-letter">
      <p class="jr-letter-date">${esc([letter.place, letter.date || today()].filter(Boolean).join(', '))}</p>
      <h2 id="jr-title" class="jr-visually-hidden">${esc(stops[index].title)}</h2>
      ${letter.greeting ? `<p class="jr-letter-greeting">${esc(letter.greeting)}</p>` : ''}
      <div class="jr-prose">${(letter.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      <div class="jr-letter-sign">
        ${letter.closing ? `<p>${esc(letter.closing)}</p>` : ''}
        ${letter.signature ? `<img class="jr-signature" src="${esc(letter.signature)}" alt="${esc(t('signatureOf'))} ${esc(name)}">` : `<p class="jr-signature-text">${esc(name)}</p>`}
        ${letter.signature ? `<p class="jr-letter-name">${esc(name)}</p>` : ''}
        ${contactRow()}
      </div>
    </div>
    ${letter.pdf ? `<div class="jr-actions"><a class="jr-btn" href="${esc(letter.pdf)}" download>${ICON.download}<span>${esc(t('downloadLetter'))}</span></a></div>` : ''}`;
}

const BUILDERS = { about: aboutHTML, projects: projectsHTML, letter: letterHTML };

// ─────────────────────────────────────────────────────────────────────────────
export function createJournal({ onClose, isTouch }) {
  const root = document.createElement('div');
  root.id = 'journal';
  root.className = 'jr';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'jr-title');
  root.innerHTML = `
    <div class="jr-bg"><img alt=""></div>
    <div class="jr-scroll" tabindex="-1">
      <div class="jr-layout">
        <aside class="jr-photo">
          <figure class="jr-print"><div class="jr-print-frame"><img alt=""></div>
            <figcaption><strong></strong><em></em><span></span></figcaption></figure>
        </aside>
        <article class="jr-sheet"><div class="jr-sheet-inner"></div>
          <footer class="jr-continue">
            <button class="jr-btn jr-btn-dark" data-continue><span data-i18n="continue"></span>${ICON.arrow}</button>
            <p data-i18n="${isTouch ? 'continueOrTouch' : 'continueOrWheel'}"></p>
          </footer>
        </article>
      </div>
    </div>
    <button class="jr-close" data-close>${ICON.close}<span data-i18n="close"></span></button>
    <div class="jr-pull" aria-hidden="true"><span data-i18n="keepWalking"></span><i><b></b></i></div>`;
  document.body.appendChild(root);

  const $ = (s) => root.querySelector(s);
  const scroller = $('.jr-scroll');
  const inner = $('.jr-sheet-inner');
  const pull = $('.jr-pull');
  const pullBar = pull.querySelector('b');
  let current = null;
  let openState = false;
  let lastFocus = null;
  let view = null;     // { id, index, project }
  let shot = null;     // { index }

  function chrome() {
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $('.jr-close').setAttribute('aria-label', t('closeLabel'));
  }
  function caption() {
    if (!shot) return;
    const stop = L().stops[shot.index];
    $('.jr-print figcaption strong').textContent = stop.species;
    $('.jr-print figcaption em').textContent = stop.latin;
    $('.jr-print figcaption span').textContent = `1/500 · f/2.8 · ISO 200 · ${today()} · ${shot.index + 1} ${t('of')} ${C.stops.length}`;
  }
  // Torna a pintar-ho tot a l'idioma actual, mantenint la vista i el scroll
  function refresh() {
    chrome();
    if (!openState || !view) return;
    const y = scroller.scrollTop;
    if (view.project != null) render('project', projectDetailHTML(view.project));
    else render(view.id, BUILDERS[view.id](view.index));
    caption();
    scroller.scrollTop = y;
  }

  const render = (id, html) => {
    inner.innerHTML = html;
    inner.dataset.section = id;
  };

  function open(stopId, { photo, background, index }) {
    current = stopId;
    lastFocus = document.activeElement;
    view = { id: stopId, index, project: null };
    shot = { index };
    chrome();
    render(stopId, BUILDERS[stopId](index));
    $('.jr-print img').src = photo || background || '';
    $('.jr-bg img').src = background || photo || '';
    caption();
    root.dataset.section = stopId;
    root.hidden = false;
    scroller.scrollTop = 0;
    openState = true;
    requestAnimationFrame(() => {
      root.classList.add('is-open');
      animatePrint();
      scroller.focus({ preventScroll: true });
    });
  }

  // La còpia surt de la mida de la pantalla (la foto que acabes de fer) cap al seu lloc
  function animatePrint() {
    const print = $('.jr-print');
    if (reducedMotion()) return;
    const r = print.getBoundingClientRect();
    const s = Math.max(innerWidth / r.width, innerHeight / r.height) * 0.92;
    const dx = innerWidth / 2 - (r.left + r.width / 2);
    const dy = innerHeight / 2 - (r.top + r.height / 2);
    print.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)`, filter: 'brightness(1.8)' },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35}px) scale(${1 + (s - 1) * 0.3}) rotate(-1deg)`, filter: 'brightness(1.05)', offset: 0.55 },
      { transform: 'translate(0, 0) scale(1) rotate(-1.6deg)', filter: 'brightness(1)' },
    ], { duration: 1300, easing: 'cubic-bezier(.6,0,.2,1)' });
  }

  function close(continueWalk) {
    if (!openState) return;
    if (playerOpen) closePlayer();
    openState = false;
    root.classList.remove('is-open');
    root.classList.add('is-closing');
    setPull(0);
    setTimeout(() => { root.hidden = true; root.classList.remove('is-closing'); }, reducedMotion() ? 0 : 520);
    lastFocus?.focus?.({ preventScroll: true });
    onClose?.(current, continueWalk);
  }

  // ── Projectes: obrir fitxa i tornar a la graella
  root.addEventListener('click', (e) => {
    const card = e.target.closest('[data-project]');
    if (card) {
      view.project = +card.dataset.project;
      render('project', projectDetailHTML(view.project));
      scroller.scrollTo({ top: Math.min(scroller.scrollTop, $('.jr-sheet').offsetTop - 24), behavior: 'instant' });
      inner.querySelector('[data-back]')?.focus({ preventScroll: true, focusVisible: false });
      return;
    }
    if (e.target.closest('[data-back]')) {
      view.project = null;
      render('projects', projectsHTML(view.index));
      return;
    }
    const thumb = e.target.closest('.jr-thumb');
    if (thumb) {
      const p = L().projects[view.project];
      inner.querySelectorAll('.jr-thumb').forEach((x) => x.classList.toggle('is-active', x === thumb));
      inner.querySelector('.jr-gallery-main').innerHTML = mediaMain(mediaItems(p)[+thumb.dataset.media], p.title);
      return;
    }
    const video = e.target.closest('[data-video]');
    if (video) {
      const src = video.dataset.video;
      if (src.startsWith('file:')) {
        video.parentElement.innerHTML = `<video class="jr-video-frame" src="${esc(src.slice(5))}" controls autoplay playsinline></video>`;
        return;
      }
      // Vimeo: la mateixa inserció que fa itch.io (és la que funciona); YouTube: amb reproducció automàtica
      const allow = src.includes('vimeo') ? 'fullscreen; picture-in-picture' : 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      video.parentElement.innerHTML = `<iframe class="jr-video-frame" src="${esc(src)}" title="${esc(t('trailer'))}" allow="${allow}" allowfullscreen></iframe>`;
      return;
    }
    const play = e.target.closest('[data-play]');
    if (play) return openPlayer(L().projects[+play.dataset.play]);
    if (e.target.closest('[data-continue]')) return close(true);
    if (e.target.closest('[data-close]')) return close(false);
  });

  addEventListener('keydown', (e) => {
    if (!openState) return;
    if (e.key === 'Escape') { e.preventDefault(); if (playerOpen) closePlayer(); else close(false); }
  });

  // ── Reproductor: el joc d'itch.io a pantalla gran, per sobre del quadern
  const player = document.createElement('div');
  player.className = 'jr-player';
  player.hidden = true;
  player.innerHTML = `
    <div class="jr-player-bar">
      <strong class="jr-player-title"></strong>
      <div class="jr-player-actions">
        <button class="jr-player-btn" data-fs>${ICON.expand}<span data-i18n="fullscreen"></span></button>
        <a class="jr-player-btn" data-itch target="_blank" rel="noopener"><span data-i18n="viewOnItch"></span>${ICON.external}</a>
        <button class="jr-player-btn" data-player-close>${ICON.close}<span data-i18n="close"></span></button>
      </div>
    </div>
    <div class="jr-player-stage"><p class="jr-player-loading" data-i18n="gameLoading"></p><div class="jr-player-frame"></div></div>`;
  root.appendChild(player);
  let playerOpen = false, playerSize = null;

  function fitPlayer() {
    if (!playerOpen || !playerSize) return;
    const stage = player.querySelector('.jr-player-stage').getBoundingClientRect();
    const ratio = playerSize.width / playerSize.height;
    let w = stage.width, h = w / ratio;
    if (h > stage.height) { h = stage.height; w = h * ratio; }
    const frame = player.querySelector('.jr-player-frame');
    frame.style.width = `${Math.floor(w)}px`;
    frame.style.height = `${Math.floor(h)}px`;
  }
  function openPlayer(p) {
    if (!p?.play) return;
    playerOpen = true;
    playerSize = p.play;
    chrome();
    player.querySelector('.jr-player-title').textContent = p.title;
    const itch = player.querySelector('[data-itch]');
    itch.href = p.itchUrl || '#';
    itch.hidden = !p.itchUrl;
    player.querySelector('.jr-player-frame').innerHTML = `<iframe src="${esc(p.play.src)}" title="${esc(p.title)}"
      allow="autoplay; fullscreen *; gamepad; xr-spatial-tracking; cross-origin-isolated" allowfullscreen scrolling="no"></iframe>`;
    player.hidden = false;
    document.body.classList.add('playing');
    requestAnimationFrame(() => { player.classList.add('is-open'); fitPlayer(); player.querySelector('iframe')?.focus(); });
  }
  function closePlayer() {
    playerOpen = false;
    player.classList.remove('is-open');
    player.querySelector('.jr-player-frame').innerHTML = ''; // atura el joc i el so
    player.hidden = true;
    document.body.classList.remove('playing');
    if (document.fullscreenElement) document.exitFullscreen?.();
  }
  player.addEventListener('click', (e) => {
    if (e.target.closest('[data-player-close]')) { e.stopPropagation(); closePlayer(); }
    if (e.target.closest('[data-fs]')) { e.stopPropagation(); player.querySelector('.jr-player-frame')?.requestFullscreen?.(); }
  });
  addEventListener('resize', fitPlayer);

  // ── Fer scroll més enllà del final del full = continuar el camí
  let pullAmount = 0, pullTimer = 0;
  const PULL = 340;
  const atBottom = () => scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
  function setPull(v) {
    pullAmount = Math.max(0, v);
    const k = Math.min(1, pullAmount / PULL);
    pull.classList.toggle('is-visible', k > 0.02);
    pullBar.style.transform = `scaleX(${k})`;
    if (k >= 1) close(true);
  }
  function bumpPull(delta) {
    setPull(pullAmount + delta);
    clearTimeout(pullTimer);
    pullTimer = setTimeout(() => setPull(0), 700);
  }
  scroller.addEventListener('wheel', (e) => {
    if (!openState) return;
    if (e.deltaY > 0 && atBottom()) bumpPull(Math.min(e.deltaY, 80));
    else if (e.deltaY < 0) setPull(0);
  }, { passive: true });
  let ty = null;
  scroller.addEventListener('touchstart', (e) => { ty = e.touches[0].clientY; }, { passive: true });
  scroller.addEventListener('touchmove', (e) => {
    if (ty === null || !openState) return;
    const y = e.touches[0].clientY;
    if (atBottom() && ty - y > 0) bumpPull((ty - y) * 1.4);
    ty = y;
  }, { passive: true });
  scroller.addEventListener('touchend', () => { ty = null; if (pullAmount < PULL) setPull(0); });

  chrome();
  return { open, close, refresh, get isOpen() { return openState; }, root };
}
