/**
 * Règles mesurées sur les sources de la console (tâche 6.3).
 *
 * Ces trois contrôles ne portent pas sur un comportement mais sur une
 * PROPRIÉTÉ DU CODE, et ils se mesurent :
 *
 *   1. zéro couleur littérale (`#rrggbb`, `rgb()`, `rgba()`) — la console ne
 *      consomme que des jetons canoniques ;
 *   2. zéro emoji (règle n°8 du propriétaire) ;
 *   3. aucun jeton INCONNU : chaque `var(--x)` utilisé existe réellement dans
 *      `src/styles/jetons.css` (ou dans la feuille de socle) — une faute de
 *      frappe sur un nom de jeton ne produit pas d'erreur, seulement une
 *      couleur qui disparaît.
 *
 * Les fichiers sont lus par Vite (`?raw` / `import.meta.glob`) : un test qui lit
 * les sources ne peut pas être contourné par un rendu partiel.
 */
import { describe, expect, it } from 'vitest'

import ADMIN_HTML from '../../admin.html?raw'

/** Toutes les sources de la console, sauf les tests eux-mêmes. */
const SOURCES = import.meta.glob('./**/*.{vue,ts}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const SOURCES_PRODUCTION = Object.entries(SOURCES).filter(([chemin]) => !chemin.includes('.spec.'))

/**
 * Retire les commentaires avant de chercher un emoji : la règle n°8 porte sur
 * ce qui s'AFFICHE, et une flèche typographique `→` dans un commentaire de code
 * n'est pas un emoji d'interface. Le balisage et les libellés, eux, restent
 * intégralement analysés.
 */
function sansCommentaires(contenu: string): string {
  return contenu
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/** Emoji : mêmes plages que les autres tests du dépôt (règle n°8) */
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u

/** Couleur littérale : hexadécimal, rgb() ou rgba() */
const COULEUR_LITTERALE = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/g

/** `var(--jeton)` et `var(--jeton, repli)` */
const JETON_UTILISE = /var\(\s*(--[\w-]+)/g

describe('Console — zéro couleur littérale', () => {
  it('n’écrit aucune couleur en dur dans ses sources', () => {
    const controles: Array<[string, string]> = [
      ['admin.html', ADMIN_HTML],
      ...SOURCES_PRODUCTION,
    ]
    const coupables: string[] = []
    for (const [chemin, contenu] of controles) {
      const trouves = contenu.match(COULEUR_LITTERALE) ?? []
      if (trouves.length > 0) coupables.push(`${chemin} : ${trouves.join(', ')}`)
    }
    expect(coupables).toEqual([])
  })
})

describe('Console — zéro emoji', () => {
  it('n’en contient aucun dans le balisage ni dans les libellés', () => {
    const coupables: string[] = []
    for (const [chemin, contenu] of [
      ['admin.html', ADMIN_HTML],
      ...SOURCES_PRODUCTION,
    ] as Array<[string, string]>) {
      if (EMOJI.test(sansCommentaires(contenu))) coupables.push(chemin)
    }
    expect(coupables).toEqual([])
  })
})

describe('Console — jetons canoniques seulement', () => {
  /**
   * Liste des jetons CONSOMMÉS par la console, figée. Elle ne duplique aucune
   * VALEUR (la source unique reste `src/styles/jetons.css`) : elle fige des
   * NOMS. Un jeton mal orthographié (`--gold-2`) ne casse rien à l'exécution —
   * il rend simplement la couleur absente, ce qui est invisible en revue. Ce
   * test transforme cette faute silencieuse en échec.
   *
   * Le contrôle symétrique (« chaque nom de cette liste est bien DÉCLARÉ ») est
   * fait par `docs/phase3-tache-6-3/mesures.py`, qui lit les feuilles réelles :
   * Vitest, lui, ne charge pas le CSS (il est remplacé par une chaîne vide).
   *
   * Ajouter une entrée ici est donc un geste conscient : il faut aussi qu'elle
   * existe dans `src/styles/jetons.css`.
   */
  const JETONS_CONSOMMES: readonly string[] = [
    // Surfaces et texte
    '--bg2', '--card', '--card2', '--text', '--soft', '--muted',
    // Accent
    '--gold', '--gold2', '--gold-bg', '--gold-border', '--on-gold',
    // Filets
    '--border', '--border-strong', '--neutre-trace',
    // États
    '--succes', '--succes-filet', '--succes-trace',
    '--alerte', '--alerte-filet', '--alerte-trace',
    '--info', '--info-filet', '--info-trace',
    '--red-text', '--red-border', '--red-bg',
    // Voiles
    '--voile', '--voile-fort',
    // Géométrie
    '--arrondi-input', '--arrondi-bloc', '--arrondi-bouton', '--arrondi-carte',
    // Élévations et mouvement
    '--shadow-md', '--shadow-lg', '--t', '--t-fast', '--t-slow', '--ease-out',
    // Typographie
    '--police-titres',
  ]

  it('n’utilise que les jetons de la liste figée', () => {
    const inconnus = new Set<string>()
    for (const [, contenu] of SOURCES_PRODUCTION) {
      for (const trouve of contenu.matchAll(JETON_UTILISE)) {
        if (!JETONS_CONSOMMES.includes(trouve[1])) inconnus.add(trouve[1])
      }
    }
    expect([...inconnus]).toEqual([])
  })

  it('ne consomme aucun jeton du contrat interne du noyau (--p-*)', () => {
    // Les primitives du noyau ne se consomment jamais directement
    // (10-primitives.css:14-16) : seuls les jetons sémantiques sont admis.
    for (const [, contenu] of SOURCES_PRODUCTION) {
      expect(contenu).not.toMatch(/var\(\s*--p-/)
    }
  })
})
