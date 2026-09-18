/**
 * Vignettes de collection — SVG décrits par leurs tracés (aucun emoji, aucun
 * HTML injecté, aucun fichier image).
 *
 * Le blog n'attache pas d'image aux articles : ses propres cartes affichent
 * une icône SVG par collection (`assets/css/blog.css` → `.article-card-thumb`).
 * Le widget reprend ce langage visuel plutôt qu'une photo générique.
 */
export interface Vignette {
  /** Tracés SVG (viewBox 0 0 24 24), dessinés en `currentColor` */
  traces: string[]
}

const PAR_DEFAUT: Vignette = {
  traces: ['M6 3.5h8.5L20 9v11.5H6z', 'M14.5 3.5V9H20', 'M9 13h6M9 16.5h6'],
}

const VIGNETTES: Record<string, Vignette> = {
  acquisition: {
    traces: ['M4 19.5V13M9.6 19.5V8.5M15.2 19.5v-5M20.8 19.5V5', 'M3 21h18'],
  },
  seo: {
    traces: ['M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z', 'M15.8 15.8 20 20'],
  },
  'site-web': {
    traces: ['M3.5 5.5h17v13h-17z', 'M3.5 9.5h17', 'M6.2 7.5h.01M8.6 7.5h.01', 'M7 13h10'],
  },
  business: {
    traces: ['M4 8.5h16v10H4z', 'M9 8.5V6.2h6v2.3', 'M4 13h16'],
  },
  automatisation: {
    traces: [
      'M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z',
      'M12 3.5v2.2M12 18.3v2.2M4.9 12H2.7M21.3 12h-2.2M6.9 6.9 5.4 5.4M18.6 18.6l-1.5-1.5M17.1 6.9l1.5-1.5M5.4 18.6l1.5-1.5',
    ],
  },
  'ia-generative': {
    traces: ['M12 4.2l1.7 4.3 4.3 1.7-4.3 1.7L12 16.2l-1.7-4.3L6 10.2l4.3-1.7z', 'M18 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z'],
  },
}

/** Vignette d'une collection — repli sur le pictogramme « article » */
export function vignetteCollection(slug: string | null): Vignette {
  if (!slug) return PAR_DEFAUT
  return VIGNETTES[slug] ?? PAR_DEFAUT
}
