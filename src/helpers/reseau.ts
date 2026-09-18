/**
 * État réseau du document — source unique de l'écran d'attente hors-ligne.
 *
 * `navigator.onLine` ne dit pas « Internet est joignable » : il dit « une
 * interface réseau est active ». C'est une approximation assumée, et elle est
 * suffisante pour ce qu'on en fait — afficher un message d'attente propre
 * pendant une coupure réelle (mode avion, tunnel, wifi tombé), et le retirer
 * automatiquement au retour. Mia ne dépend pas de cet état pour répondre : si
 * le réseau revient, la conversation reprend sans rechargement.
 */

import { ref } from 'vue'

/** Vrai quand le document se sait hors-ligne */
export const horsLigne = ref(false)

function lire(): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.onLine === false
}

/** Relit l'état et retourne la valeur courante (bouton « Réessayer ») */
export function reverifierReseau(): boolean {
  horsLigne.value = lire()
  return horsLigne.value
}

/**
 * Branche les écouteurs `online`/`offline` et retourne la fonction de
 * nettoyage. Idempotent : un second appel ne double pas les écouteurs.
 */
let branche = false
export function initReseau(): () => void {
  if (typeof window === 'undefined') return () => {}
  reverifierReseau()
  if (branche) return () => {}
  branche = true
  const maj = () => reverifierReseau()
  window.addEventListener('online', maj)
  window.addEventListener('offline', maj)
  return () => {
    window.removeEventListener('online', maj)
    window.removeEventListener('offline', maj)
    branche = false
  }
}
