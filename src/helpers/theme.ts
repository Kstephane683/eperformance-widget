/**
 * Thème clair/sombre — hors iframe (application Mia, pages publiques).
 *
 * Dans une iframe, rien de tout ceci ne s'applique : le thème du widget est
 * celui du SITE hôte, transmis par le SDK (query param au chargement,
 * postMessage à chaque bascule). Ces fonctions servent au document de premier
 * niveau, où il n'y a pas de site hôte :
 *
 *   1. le choix explicite du visiteur (`localStorage['eperf-theme']` — même clé
 *      que le site, contrat C4 de COORDINATION-AGENTS.md) ;
 *   2. à défaut, la préférence du système, suivie en direct ;
 *   3. à défaut, le clair — le défaut du site.
 */

import { estDansIframe } from '@/helpers/environnement'

/** Clé de mémorisation du thème — identique à celle du site (contrat C4) */
export const CLE_THEME = 'eperf-theme'

export type Theme = 'light' | 'dark'

function stockage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Choix explicite du visiteur, ou null s'il n'a jamais choisi */
export function lireThemeMemorise(store: Storage | null = stockage()): Theme | null {
  try {
    const valeur = store?.getItem(CLE_THEME)
    return valeur === 'dark' || valeur === 'light' ? valeur : null
  } catch {
    return null
  }
}

/** Préférence du système (clair par défaut si l'API n'existe pas) */
export function themeSysteme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Thème effectivement appliqué au document */
export function themeCourant(): Theme {
  const attribut = document.documentElement.getAttribute('data-theme')
  if (attribut === 'dark' || attribut === 'light') return attribut
  return lireThemeMemorise() ?? themeSysteme()
}

/** Applique un thème au document — et le mémorise si c'est un choix explicite */
export function appliquerTheme(theme: Theme, memoriser = true): void {
  document.documentElement.setAttribute('data-theme', theme)
  if (!memoriser) return
  try {
    stockage()?.setItem(CLE_THEME, theme)
  } catch {
    /* stockage bloqué : le thème reste appliqué pour la session */
  }
}

/** Bascule clair ↔ sombre (bouton des pages publiques) */
export function basculerTheme(): Theme {
  const suivant: Theme = themeCourant() === 'dark' ? 'light' : 'dark'
  appliquerTheme(suivant)
  return suivant
}

/**
 * Suit la préférence du système tant que le visiteur n'a pas choisi, et tant
 * que le thème n'est pas piloté par le SDK (`?theme=` dans l'URL).
 * Retourne la fonction de nettoyage.
 */
export function initThemeAuto(): () => void {
  if (estDansIframe()) return () => {}
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  if (new URLSearchParams(window.location.search).has('theme')) return () => {}
  if (lireThemeMemorise()) return () => {}

  const requete = window.matchMedia('(prefers-color-scheme: dark)')
  const maj = (evenement: MediaQueryListEvent | MediaQueryList) => {
    if (lireThemeMemorise()) return // le visiteur a choisi entre-temps
    document.documentElement.setAttribute('data-theme', evenement.matches ? 'dark' : 'light')
  }
  requete.addEventListener('change', maj)
  return () => requete.removeEventListener('change', maj)
}
