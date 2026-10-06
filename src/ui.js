import * as C from './content.js';
import { tr, t } from './i18n.js';

// Text curt que es veu dins del món 3D (la informació completa és al quadern, journal.js)
export function surfaceLines(stopId) {
  if (stopId === 'about') return tr(C.about.marker) || [];
  if (stopId === 'letter') return tr(C.letter.marker) || [];
  if (stopId === 'projects') return tr(C.projects);
  return [];
}

export const stopTitle = (stopId) => tr(C.stops.find((s) => s.id === stopId)).title;

export function trailheadContent(isTouch) {
  const p = tr(C.profile);
  return {
    name: p.name,
    role: p.role,
    tagline: p.tagline,
    stops: [...tr(C.stops).map((s) => s.title), t('viewpoint')],
    hint: t(isTouch ? 'startTouch' : 'startWheel'),
    kicker: t('trailKicker'),
    here: t('youAreHere'),
    // El model de l'aligot és CC-BY: cal citar-ne l'autor
    credits: t('credits'),
  };
}
