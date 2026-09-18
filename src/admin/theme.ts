/**
 * Thème de la console — clair, sombre ou système.
 *
 * La console n'est plus en sombre seul : la tâche 6.3 demande les deux thèmes,
 * et un opérateur qui travaille en plein jour doit pouvoir lire sa console.
 *
 * Le choix est mémorisé sous la MÊME clé que le site et le widget
 * (`localStorage['eperf-theme']`, contrat C4 de COORDINATION-AGENTS.md) : c'est
 * le même visiteur, sur la même origine. La différence avec
 * `src/helpers/theme.ts` (widget) est l'état explicite « Système » : une console
 * doit pouvoir dire « suis le système » autrement que par l'absence de choix.
 *   · `eperf-theme = 'dark'`  → sombre ;
 *   · `eperf-theme = 'light'` → clair ;
 *   · clé absente             → système (suivi en direct).
 *
 * La couleur de barre du navigateur (`meta[name=theme-color]`) est posée à
 * partir du jeton `--bg` : `admin.html` ne contient donc AUCUNE couleur en dur.
 */

export type ChoixTheme = 'clair' | 'sombre' | 'systeme'
export type ThemeApplique = 'light' | 'dark'

/** Clé de mémorisation du thème — identique au site et au widget (contrat C4). */
export const CLE_THEME = 'eperf-theme'

function stockage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Préférence du système (clair si l'API n'existe pas). */
export function themeSysteme(): ThemeApplique {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Choix mémorisé — `systeme` quand rien n'a été choisi. */
export function lireChoix(store: Storage | null = stockage()): ChoixTheme {
  try {
    const valeur = store?.getItem(CLE_THEME)
    if (valeur === 'dark') return 'sombre'
    if (valeur === 'light') return 'clair'
  } catch {
    /* stockage bloqué : on reste sur « système » */
  }
  return 'systeme'
}

/** Thème réellement appliqué, déduit du document puis du choix. */
export function themeApplique(): ThemeApplique {
  const attribut = document.documentElement.getAttribute('data-theme')
  if (attribut === 'dark' || attribut === 'light') return attribut
  const choix = lireChoix()
  return choix === 'systeme' ? themeSysteme() : choix === 'sombre' ? 'dark' : 'light'
}

/**
 * Applique un choix : pose `data-theme`, mémorise (ou efface pour « système »)
 * et remet la couleur de barre du navigateur au jeton `--bg` du thème retenu.
 */
export function appliquerChoix(choix: ChoixTheme, memoriser = true): ThemeApplique {
  const applique: ThemeApplique = choix === 'systeme' ? themeSysteme() : choix === 'sombre' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', applique)
  if (memoriser) {
    try {
      const store = stockage()
      if (choix === 'systeme') store?.removeItem(CLE_THEME)
      else store?.setItem(CLE_THEME, applique)
    } catch {
      /* stockage bloqué : le choix vaut pour la session */
    }
  }
  synchroniserCouleurBarre(applique)
  return applique
}

/**
 * `meta[name=theme-color]` ← valeur calculée de `--bg`.
 * L'élément est créé s'il n'existe pas : c'est ce qui permet à `admin.html` de
 * ne déclarer aucune couleur.
 */
export function synchroniserCouleurBarre(theme: ThemeApplique = themeApplique()): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  const fond = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (!fond) return
  let meta = document.head.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', fond)
}

/**
 * Suit la préférence du système tant que l'opérateur n'a pas choisi de thème.
 * Retourne la fonction de nettoyage (appelée au démontage du shell).
 */
export function suivreSysteme(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const requete = window.matchMedia('(prefers-color-scheme: dark)')
  const maj = () => {
    if (lireChoix() !== 'systeme') return // un choix explicite a été fait entre-temps
    appliquerChoix('systeme', false)
  }
  requete.addEventListener('change', maj)
  return () => requete.removeEventListener('change', maj)
}
