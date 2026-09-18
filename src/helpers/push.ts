/**
 * Notifications push — consentement, abonnement, désabonnement (P3-PUSH).
 *
 * CE QUE CE MODULE FAIT, ET CE QU'IL NE FAIT PAS
 * ---------------------------------------------
 * Le service worker (`public/sw.js`, tâche 6.4) sait déjà RECEVOIR un push et
 * ouvrir l'application au clic. Le backend sait déjà ENREGISTRER un abonnement
 * et ENVOYER. Il manquait le milieu : appeler `PushManager.subscribe()` côté
 * navigateur, puis enregistrer l'abonnement. C'est ici.
 *
 * LA RÈGLE LA PLUS IMPORTANTE : JAMAIS DE DEMANDE NON SOLLICITÉE
 * --------------------------------------------------------------
 * `Notification.requestPermission()` n'est appelé que depuis le clic d'un
 * visiteur sur un bouton identifiable. Jamais au chargement, jamais depuis un
 * effet de bord, jamais depuis une minuterie. Une demande de permission non
 * sollicitée est un motif de rejet par les stores et une mauvaise expérience :
 * c'est le même principe que l'invite d'installation de la tâche 6.4, et il est
 * appliqué ici de la même façon. Le seul appel à `requestPermission` de tout le
 * widget est dans `activerNotifications()`, qui n'est atteignable que par un
 * clic — et un test le verrouille (`aucune demande de permission sans clic`).
 *
 * Un visiteur qui a refusé n'est JAMAIS relancé : quand
 * `Notification.permission` vaut `denied`, la fonction retourne l'état
 * `refuse` sans rien demander. Le navigateur ne reposerait de toute façon plus
 * la question ; insister ne produirait qu'un échec silencieux.
 *
 * QUATRE ÉTATS LISIBLES, ET UN CINQUIÈME QUI N'AFFICHE RIEN
 * --------------------------------------------------------
 *   `indisponible` — l'API n'existe pas ici : navigateur ancien, contexte non
 *                    sécurisé, iframe (règle 6.4 : pas de service worker dans
 *                    une iframe), ou iOS Safari sans installation — sur iPhone
 *                    et iPad, le push n'existe que dans l'application installée.
 *   `non_configure`— le serveur n'a pas de clé publique VAPID (état actuel de
 *                    la production). Rien à proposer, rien de cassé.
 *   `inactif`      — proposable : c'est l'état d'un visiteur qui n'a pas encore
 *                    choisi.
 *   `refuse`       — le visiteur a refusé (ou l'a fait auparavant). On ne
 *                    relance pas ; on explique où revenir sur sa décision.
 *   `abonne`       — abonnement actif, enregistré côté serveur.
 *   `erreur`       — une étape a échoué ; on peut réessayer.
 *
 * `indisponible` et `non_configure` ne sont PAS affichés : l'interface ne
 * propose simplement pas la fonctionnalité, et rien ne casse. Les quatre autres
 * sont lisibles par le visiteur.
 *
 * LA CLÉ PUBLIQUE VIENT DU SERVEUR
 * --------------------------------
 * `PushManager.subscribe()` exige la clé publique VAPID en
 * `applicationServerKey`. Elle est récupérée par
 * `GET /api/chatbot/push/config` : jamais écrite en dur ici, sinon une rotation
 * de clés obligerait à republier le widget. Elle est convertie en octets
 * (`cleApplicationServerKey`) parce que c'est la forme que tous les navigateurs
 * analysent sans ambiguïté.
 */

import { estDansIframe } from '@/helpers/environnement'
import { enregistrerServiceWorker } from '@/helpers/pwa'

/** Chemin de la configuration push, relatif à la base d'API du widget */
export const CHEMIN_CONFIG_PUSH = '/api/chatbot/push/config'

/** Clé d'état locale — une seule entrée, lisible par un humain */
export const CLE_ETAT_NOTIFICATIONS = 'eperf_mia_notifications'

/** Délai maximal d'attente d'un service worker actif avant de renoncer */
export const DELAI_SERVICE_WORKER_MS = 10_000

export type EtatNotifications =
  | 'indisponible'
  | 'non_configure'
  | 'inactif'
  | 'refuse'
  | 'abonne'
  | 'erreur'

/** Ce que le serveur annonce : la fonctionnalité est-elle utilisable ? */
export interface ConfigPush {
  configure: boolean
  clePublique: string | null
  raison: string | null
}

/** Ce que le widget mémorise entre deux visites */
export interface EtatNotificationsMemorise {
  /** Le visiteur a un abonnement enregistré côté serveur */
  abonne: boolean
  /** Dernier endpoint connu — sert au désabonnement et au diagnostic */
  endpoint: string | null
  /** Date du dernier échec (ms), pour l'affichage */
  erreurLe: number | null
}

const ETAT_VIDE: EtatNotificationsMemorise = { abonne: false, endpoint: null, erreurLe: null }

// ============================================================
// ÉTAT MÉMORISÉ
// ============================================================

/** Stockage local tolérant : navigation privée ou stockage bloqué → état vide */
function stockage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function lireEtatNotifications(
  store: Storage | null = stockage(),
): EtatNotificationsMemorise {
  if (!store) return { ...ETAT_VIDE }
  try {
    const brut = store.getItem(CLE_ETAT_NOTIFICATIONS)
    if (!brut) return { ...ETAT_VIDE }
    const lu = JSON.parse(brut) as Partial<EtatNotificationsMemorise>
    return {
      abonne: lu.abonne === true,
      endpoint: typeof lu.endpoint === 'string' && lu.endpoint ? lu.endpoint : null,
      erreurLe: typeof lu.erreurLe === 'number' ? lu.erreurLe : null,
    }
  } catch {
    return { ...ETAT_VIDE }
  }
}

export function ecrireEtatNotifications(
  etat: EtatNotificationsMemorise,
  store: Storage | null = stockage(),
): void {
  try {
    store?.setItem(CLE_ETAT_NOTIFICATIONS, JSON.stringify(etat))
  } catch {
    /* stockage bloqué : l'état se perdra, ce n'est pas bloquant */
  }
}

// ============================================================
// CAPACITÉS DU NAVIGATEUR — PUR, SANS EFFET DE BORD
// ============================================================

/**
 * L'API push est-elle utilisable DANS CE CONTEXTE ?
 *
 * Cinq conditions, et chacune a une raison :
 *   · pas dans une iframe — le widget tourne sur des sites tiers ; y
 *     enregistrer un service worker poserait un cache au nom de l'hôte, et
 *     `Notification.requestPermission()` y est de toute façon refusé par les
 *     navigateurs (politique des iframes cross-origin). C'est la règle déjà
 *     posée par la tâche 6.4 pour le service worker.
 *   · contexte sécurisé — l'API Service Worker et `PushManager` n'existent pas
 *     hors https (sauf localhost).
 *   · `serviceWorker`, `PushManager` et `Notification` présents.
 *
 * Sur iPhone et iPad, `PushManager` n'existe QUE dans l'application installée
 * (iOS 16.4+) : sans installation, cette fonction retourne faux et l'interface
 * ne propose rien — le cas est donc traité par construction, sans code
 * spécifique à la plateforme.
 */
export function supportPush(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  if (estDansIframe()) return false
  if (window.isSecureContext !== true) return false
  if (!('serviceWorker' in navigator)) return false
  if (!('PushManager' in window)) return false
  if (!('Notification' in window)) return false
  return true
}

/** Permission actuelle, ou null si l'API n'existe pas dans ce contexte */
export function permissionNotifications(): NotificationPermission | null {
  if (!supportPush()) return null
  return Notification.permission
}

/**
 * Décide de l'état à afficher. Fonction PURE : toute la politique est ici, le
 * composant ne fait que l'appliquer, et les tests n'ont pas besoin de DOM.
 */
export function resoudreEtatNotifications(contexte: {
  support: boolean
  config: ConfigPush | null
  permission: NotificationPermission | null
  abonne: boolean
  erreur?: boolean
}): EtatNotifications {
  if (contexte.erreur) return 'erreur'
  if (!contexte.support) return 'indisponible'
  if (!contexte.config || !contexte.config.configure || !contexte.config.clePublique) {
    return 'non_configure'
  }
  if (contexte.permission === 'denied') return 'refuse'
  if (contexte.abonne && contexte.permission === 'granted') return 'abonne'
  return 'inactif'
}

/** L'état mérite-t-il d'être montré au visiteur ? */
export function etatAffichable(etat: EtatNotifications): boolean {
  return etat === 'inactif' || etat === 'refuse' || etat === 'abonne' || etat === 'erreur'
}

/**
 * Clé publique base64url → octets, pour `applicationServerKey`.
 *
 * Le navigateur accepte aussi la chaîne, mais sa lecture dépend de
 * l'implémentation (certaines versions refusent le base64url non rempli) : la
 * conversion en octets est la forme canonique de la spécification, et la seule
 * qui ne dépende d'aucune tolérance.
 */
export function cleApplicationServerKey(cleBase64url: string): Uint8Array<ArrayBuffer> {
  // Le remplissage est retiré avant d'être recalculé : `atob` refuse une chaîne
  // qui en porte déjà au mauvais endroit, et le serveur tolère lui aussi une
  // clé collée avec du remplissage.
  const normalisee = (cleBase64url || '')
    .trim()
    .replace(/=+$/, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const remplissage = '='.repeat((4 - (normalisee.length % 4)) % 4)
  const binaire = atob(normalisee + remplissage)
  const octets = new Uint8Array(binaire.length)
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i)
  return octets
}

// ============================================================
// SERVEUR
// ============================================================

/**
 * Récupère la configuration push. Ne lève jamais : une panne réseau ou une
 * réponse illisible donne `null`, que l'appelant traduit en « rien à
 * proposer ». Un visiteur ne doit jamais voir une erreur pour une
 * fonctionnalité qu'il n'a pas demandée.
 */
export async function recupererConfigPush(
  apiBase: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConfigPush | null> {
  try {
    const reponse = await fetchImpl(`${apiBase}${CHEMIN_CONFIG_PUSH}`, { method: 'GET' })
    if (!reponse.ok) return null
    const corps = (await reponse.json()) as Record<string, unknown>
    const cle = typeof corps?.cle_publique === 'string' ? corps.cle_publique.trim() : ''
    return {
      configure: corps?.configure === true,
      clePublique: cle || null,
      raison: typeof corps?.raison === 'string' ? corps.raison : null,
    }
  } catch {
    return null
  }
}

/** Forme de l'abonnement navigateur telle que le backend l'attend */
interface AbonnementSerialise {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

function serialiserAbonnement(abonnement: PushSubscription): AbonnementSerialise | null {
  try {
    const json = abonnement.toJSON() as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    }
    const endpoint = json.endpoint || abonnement.endpoint
    const p256dh = json.keys?.p256dh
    const auth = json.keys?.auth
    if (!endpoint || !p256dh || !auth) return null
    return { endpoint, keys: { p256dh, auth } }
  } catch {
    return null
  }
}

async function enregistrerSurLeServeur(
  abonnement: AbonnementSerialise,
  params: { apiBase: string; siteId: string; conversationId?: string | null },
  fetchImpl: typeof fetch,
): Promise<boolean> {
  try {
    const reponse = await fetchImpl(`${params.apiBase}/api/chatbot/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: abonnement.endpoint,
        keys: abonnement.keys,
        conversation_id: params.conversationId || undefined,
        site_id: params.siteId,
      }),
    })
    return reponse.ok
  } catch {
    return false
  }
}

async function retirerDuServeur(
  endpoint: string,
  apiBase: string,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  try {
    const reponse = await fetchImpl(
      `${apiBase}/api/chatbot/push/unsubscribe?endpoint=${encodeURIComponent(endpoint)}`,
      { method: 'DELETE' },
    )
    return reponse.ok
  } catch {
    return false
  }
}

/**
 * Enregistrement du service worker, ACTIF.
 *
 * `pushManager.subscribe()` échoue sur un enregistrement qui n'est pas encore
 * activé (première visite : le worker est en cours d'installation). On attend
 * donc un worker actif, avec un délai maximal : un service worker qui ne
 * s'active jamais doit produire une erreur affichable, pas un bouton qui reste
 * bloqué.
 */
async function enregistrementActif(): Promise<ServiceWorkerRegistration | null> {
  try {
    let enregistrement = await navigator.serviceWorker.getRegistration()
    if (!enregistrement) {
      await enregistrerServiceWorker()
      enregistrement = await navigator.serviceWorker.getRegistration()
    }
    if (!enregistrement) return null
    if (enregistrement.active) return enregistrement

    const actif = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), DELAI_SERVICE_WORKER_MS)),
    ])
    return actif || null
  } catch {
    return null
  }
}

/** Abonnement navigateur existant, s'il y en a un */
async function abonnementExistant(): Promise<PushSubscription | null> {
  try {
    const enregistrement = await enregistrementActif()
    if (!enregistrement) return null
    return await enregistrement.pushManager.getSubscription()
  } catch {
    return null
  }
}

export interface ResultatNotifications {
  etat: EtatNotifications
  message: string
}

// ============================================================
// LES DEUX ACTIONS DU VISITEUR
// ============================================================

export interface ParametresActivation {
  apiBase: string
  siteId: string
  conversationId?: string | null
  fetchImpl?: typeof fetch
  /** Injectable pour les tests : la vraie fonction est celle du navigateur */
  demanderPermission?: () => Promise<NotificationPermission>
}

/**
 * ACTIVE les notifications. À n'appeler QUE depuis un clic du visiteur.
 *
 * C'est le seul chemin du widget qui appelle `Notification.requestPermission()`,
 * et il ne le fait que si la permission n'a jamais été décidée (`default`).
 * Une permission déjà accordée ne redemande rien ; une permission refusée
 * n'est même pas tentée.
 */
export async function activerNotifications(
  params: ParametresActivation,
): Promise<ResultatNotifications> {
  const fetchImpl = params.fetchImpl ?? fetch

  if (!supportPush()) {
    return {
      etat: 'indisponible',
      message:
        'Les notifications ne sont pas disponibles ici. Sur iPhone et iPad, elles ' +
        'fonctionnent dans l’application installée ; dans une page qui affiche Mia, ' +
        'elles ne sont pas proposées.',
    }
  }

  if (Notification.permission === 'denied') {
    return { etat: 'refuse', message: MESSAGE_REFUS }
  }

  if (Notification.permission === 'default') {
    const demander = params.demanderPermission ?? (() => Notification.requestPermission())
    let permission: NotificationPermission
    try {
      permission = await demander()
    } catch {
      return { etat: 'erreur', message: MESSAGE_ERREUR }
    }
    if (permission !== 'granted') {
      return { etat: 'refuse', message: MESSAGE_REFUS }
    }
  }

  const config = await recupererConfigPush(params.apiBase, fetchImpl)
  if (!config || !config.configure || !config.clePublique) {
    return { etat: 'non_configure', message: MESSAGE_NON_CONFIGURE }
  }

  try {
    const enregistrement = await enregistrementActif()
    if (!enregistrement) {
      return { etat: 'erreur', message: MESSAGE_ERREUR }
    }

    let abonnement = await enregistrement.pushManager.getSubscription()
    if (!abonnement) {
      abonnement = await enregistrement.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cleApplicationServerKey(config.clePublique),
      })
    }

    const serialise = serialiserAbonnement(abonnement)
    if (!serialise) {
      return { etat: 'erreur', message: MESSAGE_ERREUR }
    }

    const enregistre = await enregistrerSurLeServeur(
      serialise,
      { apiBase: params.apiBase, siteId: params.siteId, conversationId: params.conversationId },
      fetchImpl,
    )

    if (!enregistre) {
      ecrireEtatNotifications({ abonne: false, endpoint: serialise.endpoint, erreurLe: Date.now() })
      return { etat: 'erreur', message: MESSAGE_ERREUR }
    }

    ecrireEtatNotifications({ abonne: true, endpoint: serialise.endpoint, erreurLe: null })
    return { etat: 'abonne', message: 'Les notifications sont activées sur cet appareil.' }
  } catch {
    return { etat: 'erreur', message: MESSAGE_ERREUR }
  }
}

export interface ParametresDesabonnement {
  apiBase: string
  fetchImpl?: typeof fetch
}

/**
 * DÉSABONNE l'appareil.
 *
 * Ordre volontaire : le serveur est prévenu AVANT le navigateur. C'est le
 * serveur qui décide d'envoyer ; s'il refuse la requête, l'abonnement local est
 * conservé et l'opération peut être réessayée. Dans l'autre sens, une panne
 * réseau laisserait un abonnement local vivant et un serveur qui envoie
 * encore — exactement ce que le visiteur a demandé d'arrêter.
 */
export async function desabonnerNotifications(
  params: ParametresDesabonnement,
): Promise<ResultatNotifications> {
  const fetchImpl = params.fetchImpl ?? fetch
  const memorise = lireEtatNotifications()

  const abonnement = await abonnementExistant()
  const endpoint = abonnement?.endpoint || memorise.endpoint

  if (!endpoint) {
    // Rien à désabonner : l'état local est remis à zéro, l'opération est
    // idempotente comme la route du serveur.
    ecrireEtatNotifications({ ...ETAT_VIDE })
    return { etat: 'inactif', message: 'Les notifications sont désactivées sur cet appareil.' }
  }

  const retire = await retirerDuServeur(endpoint, params.apiBase, fetchImpl)
  if (!retire) {
    ecrireEtatNotifications({ ...memorise, erreurLe: Date.now() })
    return { etat: 'erreur', message: MESSAGE_ERREUR }
  }

  try {
    await abonnement?.unsubscribe()
  } catch {
    // Le serveur n'enverra plus : le visiteur n'a plus rien à recevoir même si
    // le navigateur conserve une inscription locale.
  }

  ecrireEtatNotifications({ ...ETAT_VIDE })
  return { etat: 'inactif', message: 'Les notifications sont désactivées sur cet appareil.' }
}

/**
 * Remet le serveur au courant d'un abonnement DÉJÀ consenti.
 *
 * Appelé au chargement, et uniquement si le visiteur a déjà activé les
 * notifications : il n'y a là aucune demande, aucun effet visible. Sans cela,
 * un abonnement dont la ligne serveur a disparu (base restaurée, rotation de
 * clés) cesserait de recevoir sans que personne ne le sache.
 */
export async function resynchroniserAbonnement(params: {
  apiBase: string
  siteId: string
  conversationId?: string | null
  fetchImpl?: typeof fetch
}): Promise<boolean> {
  const memorise = lireEtatNotifications()
  if (!memorise.abonne) return false
  if (!supportPush() || Notification.permission !== 'granted') return false

  const abonnement = await abonnementExistant()
  if (!abonnement) return false

  const serialise = serialiserAbonnement(abonnement)
  if (!serialise) return false

  const ok = await enregistrerSurLeServeur(
    serialise,
    { apiBase: params.apiBase, siteId: params.siteId, conversationId: params.conversationId },
    params.fetchImpl ?? fetch,
  )
  if (ok) {
    ecrireEtatNotifications({ abonne: true, endpoint: serialise.endpoint, erreurLe: null })
  }
  return ok
}

// ============================================================
// TEXTES — une seule source, aucun emoji
// ============================================================

export const MESSAGE_REFUS =
  'Vous avez refusé les notifications. Pour revenir sur ce choix, autorisez-les pour ' +
  'ce site dans les réglages de votre navigateur.'

export const MESSAGE_NON_CONFIGURE =
  'Les notifications ne sont pas encore disponibles : Mia ne peut pas les envoyer ' +
  'depuis ce serveur.'

export const MESSAGE_ERREUR =
  'Les notifications n’ont pas pu être activées. Réessayez dans un instant.'
