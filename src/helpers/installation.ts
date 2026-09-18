/**
 * Installation de l'application Mia — capture de l'invite du navigateur,
 * politique d'affichage de notre propre invite, et déclenchement.
 *
 * TROIS RÈGLES DU PROPRIÉTAIRE, appliquées ici et testées dans
 * `installation.spec.ts` :
 *   1. jamais au premier chargement (compteur de visites + délai après montage) ;
 *   2. jamais par-dessus une conversation en cours (écran Conversation et fil
 *      déjà engagé exclus) ;
 *   3. mémorisée : un refus vaut pour 30 jours, une installation vaut pour
 *      toujours.
 *
 * `beforeinstallprompt` est émis par Chromium **une fois par chargement** et
 * peut arriver avant que le composant d'invite n'existe : l'événement est donc
 * capturé au plus tôt (`capterInviteNavigateur()`, appelé depuis `main.ts` et
 * depuis les pages publiques) puis rejoué à la demande.
 */

import { estModeApplication } from '@/helpers/environnement'

/** Événement Chromium non standardisé : la forme minimale dont nous avons besoin */
export interface EvenementInstallation extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * L'application tourne-t-elle déjà comme application installée ?
 * Ré-export assumé : les composants n'importent qu'un seul module.
 */
export const dejaInstallee = estModeApplication

/** Clé d'état (refus, visites) — une seule entrée, lisible par un humain */
export const CLE_ETAT_INSTALLATION = 'eperf_mia_installation'

/** Un refus ne se repropose pas avant 30 jours (délai « long » demandé) */
export const DELAI_REFUS_MS = 30 * 24 * 60 * 60 * 1000

/** Jamais dans les premières secondes : l'invite attend que la page vive */
export const DELAI_AVANT_INVITE_MS = 12_000

/** Deuxième visite minimum : la première sert à découvrir Mia */
export const VISITES_MINIMUM = 2

export interface EtatInstallation {
  /** Date du dernier refus (ms) — null si jamais refusé */
  refusLe: number | null
  /** Nombre de visites enregistrées */
  visites: number
  /** Application installée (événement `appinstalled` reçu) */
  installee: boolean
}

const ETAT_VIDE: EtatInstallation = { refusLe: null, visites: 0, installee: false }

/** Stockage local tolérant : navigation privée ou stockage bloqué → état vide */
function stockage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function lireEtatInstallation(store: Storage | null = stockage()): EtatInstallation {
  if (!store) return { ...ETAT_VIDE }
  try {
    const brut = store.getItem(CLE_ETAT_INSTALLATION)
    if (!brut) return { ...ETAT_VIDE }
    const lu = JSON.parse(brut) as Partial<EtatInstallation>
    return {
      refusLe: typeof lu.refusLe === 'number' ? lu.refusLe : null,
      visites: typeof lu.visites === 'number' && lu.visites >= 0 ? lu.visites : 0,
      installee: lu.installee === true,
    }
  } catch {
    return { ...ETAT_VIDE }
  }
}

export function ecrireEtatInstallation(
  etat: EtatInstallation,
  store: Storage | null = stockage(),
): void {
  try {
    store?.setItem(CLE_ETAT_INSTALLATION, JSON.stringify(etat))
  } catch {
    /* stockage bloqué : l'invite se reproposera, ce n'est pas bloquant */
  }
}

/** Enregistre une visite et retourne l'état mis à jour */
export function enregistrerVisite(
  store: Storage | null = stockage(),
  maintenant: number = Date.now(),
): EtatInstallation {
  const etat = lireEtatInstallation(store)
  const suivant: EtatInstallation = {
    ...etat,
    visites: etat.visites + 1,
    // Un refus plus vieux que le délai est oublié : l'invite redevient possible
    refusLe: etat.refusLe !== null && maintenant - etat.refusLe >= DELAI_REFUS_MS ? null : etat.refusLe,
  }
  ecrireEtatInstallation(suivant, store)
  return suivant
}

export function enregistrerRefus(
  store: Storage | null = stockage(),
  maintenant: number = Date.now(),
): void {
  ecrireEtatInstallation({ ...lireEtatInstallation(store), refusLe: maintenant }, store)
}

export function enregistrerInstallation(store: Storage | null = stockage()): void {
  ecrireEtatInstallation({ ...lireEtatInstallation(store), installee: true, refusLe: null }, store)
}

export interface ContexteInvite {
  etat: EtatInstallation
  /** L'application tourne déjà en mode installé (display-mode standalone) */
  modeApplication: boolean
  /** Le délai après montage est écoulé */
  delaiEcoule: boolean
  /** Écran courant du routeur (`home`, `conversation`, …) */
  route: string
  /** Le fil contient au moins un message du visiteur (conversation engagée) */
  conversationEnCours: boolean
  /** Un refus vieux de plus de 30 jours ne compte plus */
  maintenant?: number
}

/**
 * L'invite d'installation doit-elle être affichée ?
 * Fonction pure : toute la politique est ici, le composant ne fait que
 * l'appliquer — et les tests n'ont pas besoin de DOM.
 */
export function doitProposerInvitation(contexte: ContexteInvite): boolean {
  const { etat, modeApplication, delaiEcoule, route, conversationEnCours } = contexte
  const maintenant = contexte.maintenant ?? Date.now()

  if (modeApplication) return false // déjà installée : rien à proposer
  if (etat.installee) return false
  if (!delaiEcoule) return false // jamais dans les premières secondes
  if (etat.visites < VISITES_MINIMUM) return false // jamais au premier chargement
  if (route === 'conversation' || conversationEnCours) return false // on n'interrompt pas
  if (etat.refusLe !== null && maintenant - etat.refusLe < DELAI_REFUS_MS) return false

  return true
}

// ============================================================
// Invite du navigateur (Chromium)
// ============================================================

let inviteNavigateur: EvenementInstallation | null = null
let captureInstallee = false

/**
 * Capture `beforeinstallprompt` au plus tôt et neutralise son comportement par
 * défaut (la mini-infobulle de Chrome) : nous déclenchons l'installation depuis
 * NOS boutons, jamais depuis un bandeau imposé par le navigateur.
 */
export function capterInviteNavigateur(): void {
  if (captureInstallee || typeof window === 'undefined') return
  captureInstallee = true
  window.addEventListener('beforeinstallprompt', (evenement) => {
    evenement.preventDefault()
    inviteNavigateur = evenement as EvenementInstallation
  })
  window.addEventListener('appinstalled', () => {
    inviteNavigateur = null
    enregistrerInstallation()
  })
}

export function inviteNavigateurDisponible(): boolean {
  return inviteNavigateur !== null
}

/**
 * Déclenche l'installation. Retourne :
 *   `accepte`     — le visiteur a accepté,
 *   `refuse`      — il a refusé (mémorisé, on ne repropose pas avant 30 jours),
 *   `indisponible`— pas d'invite en attente : il faut passer par la page
 *                   d'installation (`/application/mia`), seule à porter le
 *                   manifeste quand le widget tourne dans une iframe.
 */
export async function declencherInstallation(): Promise<'accepte' | 'refuse' | 'indisponible'> {
  if (!inviteNavigateur) return 'indisponible'
  const evenement = inviteNavigateur
  inviteNavigateur = null
  try {
    await evenement.prompt()
    const choix = await evenement.userChoice
    if (choix.outcome === 'accepted') {
      enregistrerInstallation()
      return 'accepte'
    }
    enregistrerRefus()
    return 'refuse'
  } catch {
    return 'indisponible'
  }
}

/**
 * URL de la page d'installation (`/application/mia/`), résolue par rapport au
 * document courant — l'application peut être servie sous n'importe quel chemin
 * (`/eperformance-widget/`, un sous-domaine, la racine).
 */
export function urlInstallation(): string {
  if (typeof window === 'undefined') return 'application/mia/'
  try {
    return new URL('application/mia/', window.location.href).toString()
  } catch {
    return 'application/mia/'
  }
}

export function etatInstallationInitial(): EtatInstallation {
  return { ...ETAT_VIDE }
}
