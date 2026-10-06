# Portfoli 3D · Un passeig pel bosc

Comences davant del cartell del sender i puges la muntanya fent scroll. En arribar a cada animal, la càmera puja sola: fas clic per fotografiar, l'animal fuig i darrere seu apareix la informació (a l'escorça, als núvols, a l'aigua de l'estany). Després de cada foto s'obre un quadern amb tota la informació. Al cim hi ha un mirador amb vistes a la vall i les muntanyes.

## Engegar-lo

```bash
npm install      # només la primera vegada
npm run dev      # obre http://localhost:5173
```

## Què has d'editar

**Només `src/content.js`.** Els camps buits (`''` o `[]`) no es mostren, així que no cal esborrar-los.

**Idiomes:** la web és en català i anglès (es canvia amb la tecla **F** o el botó de dalt a la dreta). Qualsevol text de `content.js` pot ser una cadena (igual en tots dos idiomes) o `{ ca: '…', en: '…' }`. Els textos de la interfície són a `src/i18n.js`.

Quan fotografies un animal, s'obre un **quadern** amb tota la informació de la parada (al bosc només hi queda una marca curta, que es pot clicar per tornar-lo a obrir):

| Parada | Al quadern | Camps a `content.js` |
|---|---|---|
| Cérvol · Sobre mi | Currículum: foto, contacte, perfil, experiència, formació, habilitats, idiomes, seccions extra | `profile`, `about` |
| Aligot · Projectes | Graella de targetes amb imatge → fitxa amb galeria, metadades, tecnologies, enllaços i descàrregues | `projectsIntro`, `projects` |
| Llop · Carta | Carta formal: lloc i data, salutació, paràgrafs, comiat, signatura i PDF | `letter` |

### Fitxers (imatges, PDF, ZIP…)

Tot va dins de `public/` i s'hi fa referència començant per `/`:

```
public/
  img/foto-perfil.jpg          → profile.photo
  img/signatura.png            → letter.signature (fons transparent)
  files/cv-ferran-villa.pdf    → profile.cv.file
  files/carta.pdf              → letter.pdf
  projects/<id>/cover.jpg      → projects[].cover  (16:9, ~1600×900)
  projects/<id>/1.jpg, 2.jpg…  → projects[].gallery
  projects/<id>/qualsevol.zip  → projects[].downloads
```

Exemple de projecte complet:

```js
{
  id: 'el-meu-joc',
  title: 'El meu joc',
  year: '2025',
  role: 'Programació i disseny de nivells',
  context: 'Assignatura de Videojocs',
  summary: 'Una frase que surt a la targeta.',
  description: ['Paràgraf 1…', 'Paràgraf 2…'],
  tags: ['Unity', 'C#'],
  cover: '/projects/el-meu-joc/cover.jpg',
  gallery: ['/projects/el-meu-joc/1.jpg', '/projects/el-meu-joc/2.jpg'],
  links: [{ label: 'Repositori', url: 'https://github.com/…' }],
  downloads: [{ label: 'Build Windows', file: '/projects/el-meu-joc/build.zip', size: '120 MB' }],
}
```

> Fitxers molt grans (>100 MB): millor penjar-los a Google Drive o itch.io i posar-hi un enllaç a `links`.

### Projectes d'itch.io (jugables dins del portfoli)

1. Puja el joc a itch.io. Si és un build **WebGL de Unity**, puja'l com a *HTML* i marca «This file will be played in the browser». Si és un ZIP descarregable (Windows…), al portfoli sortirà «Descarrega a itch.io».
2. A `content.js`, posa l'enllaç al projecte: `itch: 'https://elteuusuari.itch.io/el-joc'`.
3. Executa:
   ```bash
   npm run itch
   ```
   Baixa la portada, les captures i el tràiler (YouTube o Vimeo) a `public/projects/<id>/itch/` i detecta si el joc es pot jugar al navegador.
4. Al quadern, la targeta surt amb «Jugable al navegador», i a la fitxa hi ha **Juga ara** (el joc s'obre a pantalla gran dins del portfoli) i **Veure a itch.io**.

Tot el que escriguis a `content.js` (`cover`, `gallery`, `trailer`, descripció…) té prioritat sobre el que s'importa. Si actualitzes el joc a itch.io, torna a executar `npm run itch -- --force`.

## Publicar (gratis)

1. Puja la carpeta a GitHub (amb GitHub Desktop: *Add local repository*).
2. Entra a [vercel.com](https://vercel.com) → *Add New Project* → tria el repositori → *Deploy*.
   Vercel detecta Vite sol. Cada cop que facis *push*, s'actualitza.

## Provar-ho amb captures automàtiques (opcional)

Amb `npm run dev` engegat:

```bash
STEPS="intro,enter,go:0.16,snap:cervol" node tools/shot.mjs   # desa a tools/shots/
```

## Estructura

| Fitxer | Què fa |
|---|---|
| `src/content.js` | **Tot el text** |
| `src/layout.js` | Traçat del sender i on és cada parada |
| `src/world.js` | Cel, llum, bosc, estany, soc i rètol |
| `src/terrain.js` | Terreny i camí |
| `src/animals.js` | Cérvol, aligot i llop (models animats) |
| `src/surfaces.js` | Text a l'escorça, núvols, aigua, i cartell d'inici |
| `src/main.js` | Scroll, càmera, fotos i animacions |
| `src/i18n.js` | Idiomes (català/anglès) i textos de la interfície |
| `src/ui.js` | Text curt que es mostra dins del món |
| `src/journal.js` + `journal.css` | El quadern (currículum, projectes, carta) |
| `src/post.js` | Postprocessat (gradació de color, bloom) i partícules de llum |
| `src/audio.js` | Sons (vent, ocells, obturador) sintetitzats |

## Crèdits dels models

- Natura, cérvol (Stag) i llop (Wolf): [Quaternius](https://quaternius.com) — CC0.
- Aligot («Hawk Lp Rigged»): [Sherkiz a Poly Pizza](https://poly.pizza/m/RkN6MEbP6g) — **CC-BY 3.0** (cal mantenir aquest crèdit; surt en petit al cartell d'inici).
