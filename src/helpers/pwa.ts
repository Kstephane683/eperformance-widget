/**
 * Service worker de l'application Mia — enregistrement.
 *
 * DÉCISIONS (tâche 6.4) :
 *   · **jamais dans une iframe.** Le widget tourne sur des sites tiers
 *     (eperformance.pro, des blogs, des sites clients) : y enregistrer un
 *     service worker poserait un cache sur le domaine de l'iframe au nom de
 *     l'hôte, pour un document que l'hôte n'a pas demandé. La coquille hors-
 *     ligne et l'installation ne concernent que le document de premier niveau.
 *   · **jamais en développement.** Le service worker sert les fichiers du
 *     dernier build : sous `vite dev`, il masquerait les modifications et
 *     casserait le rechargement à chaud.
 *   · l'échec est silencieux. Un navigateur sans service worker, un contexte
 *     non sécurisé (http:// hors localhost) ou un stockage bloqué ne doivent
 *     rien casser : Mia fonctionne à l'identique, sans mode hors-ligne.
 */

import { estDansIframe } from '@/helpers/environnement'

/** Nom du fichier, à la racine du dossier servi (public/sw.js → dist/sw.js) */
export const CHEMIN_SERVICE_WORKER = 'sw.js'

/** Contexte sécurisé requis par l'API Service Worker (https, ou localhost) */
function contexteSecurise(): boolean {
  if (typeof window === 'undefined') return false
  return window.isSecureContext === true
}

export interface OptionsEnregistrement {
  /** Force l'enregistrement même en développement (harnais de preuve) */
  force?: boolean
}

/**
 * Enregistre le service worker de l'application.
 * Retourne l'enregistrement, ou null si l'environnement ne s'y prête pas.
 */
export async function enregistrerServiceWorker(
  options: OptionsEnregistrement = {},
): Promise<ServiceWorkerRegistration | null> {
  if (!options.force && !import.meta.env.PROD) return null
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  if (!contexteSecurise()) return null
  if (estDansIframe()) return null
  try {
    const enregistrement = await navigator.serviceWorker.register(
      new URL(CHEMIN_SERVICE_WORKER, document.baseURI).toString(),
    )
    return enregistrement
  } catch (erreur) {
    // Le mode hors-ligne est un confort : son échec ne doit jamais gêner Mia.
    console.warn('[ePerformance] Service worker non enregistré :', erreur)
    return null
  }
}

/**
 * Demande au service worker actif de vider les caches de l'application.
 * Utilisé par le portail `/application` (action « Vider le cache local ») —
 * un utilisateur bloqué sur une version ancienne doit pouvoir s'en sortir
 * sans passer par les outils du navigateur.
 */
export async function viderCachesApplication(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) return false
  return new Promise((resolve) => {
    const canal = new MessageChannel()
    canal.port1.onmessage = () => resolve(true)
    navigator.serviceWorker.controller?.postMessage({ action: 'vider-caches' }, [canal.port2])
    setTimeout(() => resolve(false), 2000)
  })
}
