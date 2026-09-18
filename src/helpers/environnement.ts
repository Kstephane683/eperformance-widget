/**
 * Environnement d'exécution du widget — iframe d'un site hôte, ou document de
 * premier niveau (application installée, onglet ouvert directement).
 *
 * Le widget vit normalement DANS une iframe posée sur un site tiers
 * (eperformance.pro, un blog, n'importe quel hôte). Depuis la tâche 6.4, le
 * même document est aussi l'**application** Mia : il s'ouvre alors en plein
 * document, et c'est ce mode qui est installé par le manifeste
 * (`public/mia-manifest.webmanifest`).
 *
 * Ces fonctions sont pures et sans effet de bord : elles lisent `window` et
 * `navigator`, rien de plus. Elles sont donc testables telles quelles.
 */

/** Le document est-il affiché dans une iframe (site hôte) ? */
export function estDansIframe(): boolean {
  if (typeof window === 'undefined') return false
  try {
    // `window.top` est lisible en cross-origin ; comparer les références ne
    // déclenche aucune erreur, contrairement à la lecture d'une propriété.
    return window.self !== window.top
  } catch {
    return true
  }
}

/** L'application est-elle lancée comme application installée (standalone) ? */
export function estModeApplication(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari n'expose pas display-mode avant iOS 16 : propriété dédiée
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Environnement d'installation détecté à partir de la plateforme.
 *
 * `navigator.userAgentData` est préféré quand il existe ; sinon on lit l'UA.
 * Aucune décision d'affichage ne repose sur ces seules chaînes : ce qui décide,
 * c'est la présence de l'événement `beforeinstallprompt` (Chromium) — voir
 * `installation.ts`.
 */
export function plateforme(): 'ios' | 'android' | 'ordinateur' | 'inconnu' {
  if (typeof navigator === 'undefined') return 'inconnu'
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  // iPadOS 13+ se déclare « Macintosh » mais a un écran tactile
  if (/Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) {
    return 'ios'
  }
  if (/Android/.test(ua)) return 'android'
  if (/Windows|Macintosh|Linux|CrOS/.test(ua)) return 'ordinateur'
  return 'inconnu'
}

/** Navigateur de moteur WebKit/Safari (le seul sans `beforeinstallprompt` sur mobile) */
export function estSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua)
}
