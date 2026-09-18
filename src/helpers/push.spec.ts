/**
 * Tests de l'abonnement push côté navigateur (P3-PUSH).
 *
 * CE QUE CES TESTS VERROUILLENT, ET POURQUOI
 * ------------------------------------------
 *   · **aucune demande de permission sans action du visiteur** : c'est la règle
 *     la plus importante de la tâche. Un test compte les appels à
 *     `Notification.requestPermission` — zéro au chargement, zéro quand la
 *     permission est déjà refusée, un seul après un clic.
 *   · **un visiteur qui a refusé n'est jamais relancé** ;
 *   · **l'abonnement n'est enregistré que si la permission est accordée** ;
 *   · **le désabonnement prévient le serveur AVANT le navigateur** : dans
 *     l'autre ordre, une panne réseau laisserait un serveur qui envoie encore ;
 *   · **dégradation propre** : sans API push, sans service worker, sans clé
 *     publique, rien ne casse et rien n'est proposé ;
 *   · la clé publique du serveur est convertie en octets pour
 *     `applicationServerKey` (forme canonique, sans ambiguïté d'analyse).
 *
 * Aucun réseau réel : `fetch` est remplacé, comme dans les autres tests du
 * projet. Les clés et les endpoints sont des valeurs de test, jamais réelles.
 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('@/helpers/pwa', () => ({
  enregistrerServiceWorker: vi.fn().mockResolvedValue(null),
}))

import { enregistrerServiceWorker } from '@/helpers/pwa'
import {
  activerNotifications,
  cleApplicationServerKey,
  CLE_ETAT_NOTIFICATIONS,
  desabonnerNotifications,
  ecrireEtatNotifications,
  etatAffichable,
  lireEtatNotifications,
  MESSAGE_REFUS,
  permissionNotifications,
  recupererConfigPush,
  resynchroniserAbonnement,
  resoudreEtatNotifications,
  supportPush,
  type ConfigPush,
} from '@/helpers/push'

const CLE_PUBLIQUE_TEST = 'B' + 'A'.repeat(86)
const ENDPOINT_TEST = 'https://fcm.googleapis.com/fcm/send/jeton-de-test'
const P256DH_TEST = 'B'.repeat(87)
const AUTH_TEST = 'C'.repeat(22)

const CONFIG_OK: ConfigPush = {
  configure: true,
  clePublique: CLE_PUBLIQUE_TEST,
  raison: null,
}

// ============================================================
// DOUBLES DE TEST
// ============================================================

function fausseNotification(
  permission: NotificationPermission,
  resultatDemande?: NotificationPermission,
) {
  const classe = vi.fn() as unknown as {
    permission: NotificationPermission
    requestPermission: ReturnType<typeof vi.fn>
  }
  classe.permission = permission
  classe.requestPermission = vi
    .fn()
    .mockResolvedValue(resultatDemande ?? permission)
  return classe
}

function fausseSouscription() {
  return {
    endpoint: ENDPOINT_TEST,
    toJSON: () => ({ endpoint: ENDPOINT_TEST, keys: { p256dh: P256DH_TEST, auth: AUTH_TEST } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  }
}

interface OptionsEnvironnement {
  iframe?: boolean
  securise?: boolean
  pushManager?: boolean
  notification?: NotificationPermission | false
  serviceWorker?: boolean
  souscription?: ReturnType<typeof fausseSouscription> | null
  enregistrementAbsent?: boolean
}

/**
 * Pose un environnement de navigateur DÉTERMINISTE : chaque capacité est
 * décidée par le test, jamais devinée depuis jsdom.
 */
function installerEnvironnement(options: OptionsEnvironnement = {}) {
  const {
    iframe = false,
    securise = true,
    pushManager = true,
    notification = 'default',
    serviceWorker = true,
    souscription = null,
    enregistrementAbsent = false,
  } = options

  vi.stubGlobal('isSecureContext', securise)
  if (iframe) vi.stubGlobal('top', {})

  const abonnementExistant = souscription
  const abonnementCree = souscription ?? fausseSouscription()
  const enregistrement = {
    active: {} as unknown,
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(abonnementExistant),
      subscribe: vi.fn().mockResolvedValue(abonnementCree),
    },
  }
  const conteneur = {
    getRegistration: vi.fn().mockResolvedValue(enregistrementAbsent ? null : enregistrement),
    ready: Promise.resolve(enregistrement),
    register: vi.fn().mockResolvedValue(enregistrement),
  }

  const nav: Record<string, unknown> = { userAgent: 'Test/1.0', maxTouchPoints: 0 }
  if (serviceWorker) nav.serviceWorker = conteneur
  vi.stubGlobal('navigator', nav)

  if (pushManager) vi.stubGlobal('PushManager', class PushManagerFausse {})
  if (notification !== false) vi.stubGlobal('Notification', fausseNotification(notification))

  return { enregistrement, conteneur, abonnementCree }
}

/** `fetch` remplacé : chaque motif d'URL donne une réponse décidée par le test */
type FetchSimule = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>

function fauxFetch(
  reponses: Array<{ motif: string; statut?: number; corps?: unknown }>,
): FetchSimule {
  return vi.fn(async (input: RequestInfo | URL) => {
    for (const reponse of reponses) {
      if (String(input).includes(reponse.motif)) {
        const statut = reponse.statut ?? 200
        return {
          ok: statut >= 200 && statut < 300,
          status: statut,
          json: async () => reponse.corps,
        } as unknown as Response
      }
    }
    throw new Error('réseau indisponible')
  })
}

const PARAMS = { apiBase: 'https://api.exemple.test', siteId: 'eperformance_vitrine' }

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  vi.mocked(enregistrerServiceWorker).mockReset().mockResolvedValue(null)
})

// ============================================================
// 1. CAPACITÉS DU NAVIGATEUR
// ============================================================

describe('Support du push — ce qui est proposable', () => {
  it('accepte un document de premier niveau sécurisé, avec toutes les API', () => {
    installerEnvironnement()
    expect(supportPush()).toBe(true)
  })

  it('refuse DANS UNE IFRAME — règle de la tâche 6.4', () => {
    installerEnvironnement({ iframe: true })
    expect(supportPush()).toBe(false)
  })

  it('refuse hors contexte sécurisé (http:// hors localhost)', () => {
    installerEnvironnement({ securise: false })
    expect(supportPush()).toBe(false)
  })

  it('refuse quand PushManager est absent — iOS Safari sans installation', () => {
    installerEnvironnement({ pushManager: false })
    expect(supportPush()).toBe(false)
  })

  it('refuse quand le service worker est absent', () => {
    installerEnvironnement({ serviceWorker: false })
    expect(supportPush()).toBe(false)
  })

  it('refuse quand Notification est absent', () => {
    installerEnvironnement({ notification: false })
    expect(supportPush()).toBe(false)
  })

  it('la permission est illisible sans support', () => {
    installerEnvironnement({ pushManager: false })
    expect(permissionNotifications()).toBeNull()
  })

  it('la permission est lue telle quelle quand le support existe', () => {
    installerEnvironnement({ notification: 'granted' })
    expect(permissionNotifications()).toBe('granted')
  })
})

// ============================================================
// 2. POLITIQUE D'ÉTAT — FONCTION PURE
// ============================================================

describe('État des notifications — politique', () => {
  const base = { support: true, config: CONFIG_OK, permission: 'default' as const, abonne: false }

  it('est « indisponible » sans API push, quoi qu’il arrive', () => {
    expect(resoudreEtatNotifications({ ...base, support: false })).toBe('indisponible')
    expect(
      resoudreEtatNotifications({ ...base, support: false, config: null, permission: null }),
    ).toBe('indisponible')
  })

  it('est « non configuré » sans configuration serveur', () => {
    expect(resoudreEtatNotifications({ ...base, config: null })).toBe('non_configure')
  })

  it('est « non configuré » quand le serveur se déclare non configuré', () => {
    expect(
      resoudreEtatNotifications({
        ...base,
        config: { configure: false, clePublique: null, raison: 'clés absentes' },
      }),
    ).toBe('non_configure')
  })

  it('est « non configuré » quand la clé publique manque', () => {
    expect(
      resoudreEtatNotifications({ ...base, config: { configure: true, clePublique: null, raison: null } }),
    ).toBe('non_configure')
  })

  it('est « refusé » quand le visiteur a refusé', () => {
    expect(resoudreEtatNotifications({ ...base, permission: 'denied' })).toBe('refuse')
  })

  it('reste « refusé » même si un abonnement est mémorisé', () => {
    expect(resoudreEtatNotifications({ ...base, permission: 'denied', abonne: true })).toBe('refuse')
  })

  it('est « abonné » quand la permission est accordée et l’abonnement mémorisé', () => {
    expect(resoudreEtatNotifications({ ...base, permission: 'granted', abonne: true })).toBe('abonne')
  })

  it('est « inactif » quand la permission est accordée sans abonnement', () => {
    expect(resoudreEtatNotifications({ ...base, permission: 'granted' })).toBe('inactif')
  })

  it('est « erreur » quand une tentative a échoué', () => {
    expect(resoudreEtatNotifications({ ...base, erreur: true })).toBe('erreur')
  })

  it('n’affiche ni « indisponible » ni « non configuré »', () => {
    expect(etatAffichable('indisponible')).toBe(false)
    expect(etatAffichable('non_configure')).toBe(false)
    for (const etat of ['inactif', 'refuse', 'abonne', 'erreur'] as const) {
      expect(etatAffichable(etat)).toBe(true)
    }
  })
})

// ============================================================
// 3. LA CLÉ PUBLIQUE DEVIENT DES OCTETS
// ============================================================

describe('Clé publique → applicationServerKey', () => {
  it('décode un point P-256 non compressé en 65 octets', () => {
    const octets = cleApplicationServerKey(CLE_PUBLIQUE_TEST)
    expect(octets).toBeInstanceOf(Uint8Array)
    expect(octets.length).toBe(65)
    expect(octets[0]).toBe(0x04)
  })

  it('accepte l’alphabet base64url (- et _) comme le base64 standard', () => {
    expect(Array.from(cleApplicationServerKey('-_AA'))).toEqual(
      Array.from(cleApplicationServerKey('+/AA')),
    )
  })

  it('tolère un remplissage déjà présent', () => {
    expect(Array.from(cleApplicationServerKey('-_AA=='))).toEqual(
      Array.from(cleApplicationServerKey('-_AA')),
    )
  })

  it('tolère les espaces autour de la valeur', () => {
    expect(Array.from(cleApplicationServerKey(`  ${CLE_PUBLIQUE_TEST}\n`))).toEqual(
      Array.from(cleApplicationServerKey(CLE_PUBLIQUE_TEST)),
    )
  })
})

// ============================================================
// 4. LA CONFIGURATION SERVEUR
// ============================================================

describe('Configuration serveur', () => {
  it('lit une configuration complète', async () => {
    const fetchImpl = fauxFetch([
      {
        motif: '/api/chatbot/push/config',
        corps: {
          configure: true,
          cle_publique: CLE_PUBLIQUE_TEST,
          raison: null,
          canal: { configure: true },
        },
      },
    ])
    expect(await recupererConfigPush('https://api.exemple.test', fetchImpl)).toEqual(CONFIG_OK)
  })

  it('lit un état « non configuré » sans le transformer en erreur', async () => {
    const fetchImpl = fauxFetch([
      {
        motif: '/api/chatbot/push/config',
        corps: { configure: false, cle_publique: null, raison: 'VAPID_PUBLIC_KEY absente' },
      },
    ])
    const config = await recupererConfigPush('https://api.exemple.test', fetchImpl)
    expect(config?.configure).toBe(false)
    expect(config?.clePublique).toBeNull()
    expect(config?.raison).toContain('VAPID_PUBLIC_KEY')
  })

  it('ne lève jamais sur une erreur serveur', async () => {
    const fetchImpl = fauxFetch([{ motif: 'config', statut: 500, corps: {} }])
    expect(await recupererConfigPush('https://api.exemple.test', fetchImpl)).toBeNull()
  })

  it('ne lève jamais sur une panne réseau', async () => {
    const fetchImpl = fauxFetch([])
    expect(await recupererConfigPush('https://api.exemple.test', fetchImpl)).toBeNull()
  })

  it('ignore une clé publique qui n’est pas une chaîne', async () => {
    const fetchImpl = fauxFetch([
      { motif: 'config', corps: { configure: true, cle_publique: 42 } },
    ])
    const config = await recupererConfigPush('https://api.exemple.test', fetchImpl)
    expect(config?.clePublique).toBeNull()
    expect(config?.configure).toBe(true)
  })
})

// ============================================================
// 5. ACTIVER — LA RÈGLE DU CONSENTEMENT
// ============================================================

describe('Activation — consentement et abonnement', () => {
  it('ne demande RIEN et n’appelle RIEN quand l’API push est absente', async () => {
    installerEnvironnement({ pushManager: false })
    const fetchImpl = fauxFetch([])
    const demande = vi.fn()

    const resultat = await activerNotifications({ ...PARAMS, fetchImpl, demanderPermission: demande })

    expect(resultat.etat).toBe('indisponible')
    expect(demande).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('ne demande RIEN quand le visiteur a déjà refusé', async () => {
    installerEnvironnement({ notification: 'denied' })
    const fetchImpl = fauxFetch([])
    const demande = vi.fn()

    const resultat = await activerNotifications({ ...PARAMS, fetchImpl, demanderPermission: demande })

    expect(resultat.etat).toBe('refuse')
    expect(resultat.message).toBe(MESSAGE_REFUS)
    expect(demande).not.toHaveBeenCalled()
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(lireEtatNotifications().abonne).toBe(false)
  })

  it('demande la permission quand elle n’a jamais été décidée', async () => {
    // Permission « default » : le visiteur n'a jamais répondu — c'est le seul
    // cas où le navigateur accepte encore d'ouvrir la boîte de dialogue.
    installerEnvironnement({ notification: 'default' })
    const fetchImpl = fauxFetch([
      { motif: 'config', corps: { configure: true, cle_publique: CLE_PUBLIQUE_TEST } },
      { motif: 'subscribe', corps: {} },
    ])
    const demande = vi.fn().mockResolvedValue('granted')

    const resultat = await activerNotifications({ ...PARAMS, fetchImpl, demanderPermission: demande })

    expect(demande).toHaveBeenCalledTimes(1)
    expect(resultat.etat).toBe('abonne')
  })

  it('ne redemande pas la permission quand elle est déjà accordée', async () => {
    installerEnvironnement({ notification: 'granted' })
    const fetchImpl = fauxFetch([
      { motif: 'config', corps: { configure: true, cle_publique: CLE_PUBLIQUE_TEST } },
      { motif: 'subscribe', corps: {} },
    ])
    const demande = vi.fn()

    await activerNotifications({ ...PARAMS, fetchImpl, demanderPermission: demande })

    expect(demande).not.toHaveBeenCalled()
  })

  it('un refus dans la boîte de dialogue n’abonne à rien', async () => {
    const { enregistrement } = installerEnvironnement({ notification: 'default' })
    const fetchImpl = fauxFetch([
      { motif: 'config', corps: { configure: true, cle_publique: CLE_PUBLIQUE_TEST } },
    ])
    const demande = vi.fn().mockResolvedValue('denied')

    const resultat = await activerNotifications({ ...PARAMS, fetchImpl, demanderPermission: demande })

    expect(resultat.etat).toBe('refuse')
    // Le refus arrête tout AVANT la lecture de la configuration : on ne
    // prépare même pas un abonnement que le visiteur vient de refuser.
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(enregistrement.pushManager.subscribe).not.toHaveBeenCalled()
    expect(lireEtatNotifications().abonne).toBe(false)
  })

  it('n’abonne rien quand le serveur n’a pas de clé publique', async () => {
    installerEnvironnement({ notification: 'granted' })
    const fetchImpl = fauxFetch([
      { motif: 'config', corps: { configure: false, cle_publique: null } },
    ])

    const resultat = await activerNotifications({ ...PARAMS, fetchImpl })

    expect(resultat.etat).toBe('non_configure')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(lireEtatNotifications().abonne).toBe(false)
  })

  it('s’abonne avec la clé publique du serveur, en octets', async () => {
    const { enregistrement } = installerEnvironnement({ notification: 'granted' })
    const fetchImpl = fauxFetch([
      { motif: 'config', corps: { configure: true, cle_publique: CLE_PUBLIQUE_TEST } },
      { motif: 'subscribe', corps: {} },
    ])

    await activerNotifications({ ...PARAMS, fetchImpl })

    const options = enregistrement.pushManager.subscribe.mock.calls[0][0] as {
      userVisibleOnly: boolean
      applicationServerKey: Uint8Array
    }
    expect(options.userVisibleOnly).toBe(true)
    expect(options.applicationServerKey).toBeInstanceOf(Uint8Array)
    expect(options.applicationServerKey.length).toBe(65)
  })

  it('enregistre l’abonnement avec ses clés, le site et la conversation', async () => {
    installerEnvironnement({ notification: 'granted' })
    const fetchImpl = fauxFetch([
      { motif: 'config', corps: { configure: true, cle_publique: CLE_PUBLIQUE_TEST } },
      { motif: 'subscribe', corps: {} },
    ])

    await activerNotifications({ ...PARAMS, conversationId: 'conv-42', fetchImpl })

    const appel = fetchImpl.mock.calls.find(([url]) => String(url).includes('subscribe'))
    const corps = JSON.parse(String(appel?.[1]?.body))
    expect(corps.endpoint).toBe(ENDPOINT_TEST)
    expect(corps.keys).toEqual({ p256dh: P256DH_TEST, auth: AUTH_TEST })
    expect(corps.site_id).toBe('eperformance_vitrine')
    expect(corps.conversation_id).toBe('conv-42')
  })

  it('réutilise l’abonnement existant au lieu d’en créer un second', async () => {
    const existante = fausseSouscription()
    const { enregistrement } = installerEnvironnement({
      notification: 'granted',
      souscription: existante,
    })
    const fetchImpl = fauxFetch([
      { motif: 'config', corps: { configure: true, cle_publique: CLE_PUBLIQUE_TEST } },
      { motif: 'subscribe', corps: {} },
    ])

    const resultat = await activerNotifications({ ...PARAMS, fetchImpl })

    expect(enregistrement.pushManager.subscribe).not.toHaveBeenCalled()
    expect(resultat.etat).toBe('abonne')
  })

  it('signale une erreur si l’enregistrement serveur échoue, sans mentir sur l’état', async () => {
    installerEnvironnement({ notification: 'granted' })
    const fetchImpl = fauxFetch([
      { motif: 'config', corps: { configure: true, cle_publique: CLE_PUBLIQUE_TEST } },
      { motif: 'subscribe', statut: 503, corps: {} },
    ])

    const resultat = await activerNotifications({ ...PARAMS, fetchImpl })

    expect(resultat.etat).toBe('erreur')
    expect(lireEtatNotifications().abonne).toBe(false)
    expect(lireEtatNotifications().endpoint).toBe(ENDPOINT_TEST)
  })

  it('signale une erreur s’il n’y a aucun service worker actif', async () => {
    installerEnvironnement({ notification: 'granted', enregistrementAbsent: true })
    const fetchImpl = fauxFetch([
      { motif: 'config', corps: { configure: true, cle_publique: CLE_PUBLIQUE_TEST } },
    ])

    const resultat = await activerNotifications({ ...PARAMS, fetchImpl })

    expect(resultat.etat).toBe('erreur')
    expect(lireEtatNotifications().abonne).toBe(false)
  })

  it('ne laisse JAMAIS une exception sortir', async () => {
    installerEnvironnement({ notification: 'granted' })
    let appels = 0
    const fetchImpl: FetchSimule = vi.fn(async () => {
      appels += 1
      if (appels === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ configure: true, cle_publique: CLE_PUBLIQUE_TEST }),
        } as unknown as Response
      }
      throw new Error('panne au moment de l’enregistrement')
    })

    const resultat = await activerNotifications({ ...PARAMS, fetchImpl })

    expect(resultat.etat).toBe('erreur')
    expect(resultat.message).toBeTruthy()
  })

  it('une panne réseau à la lecture de la configuration ne produit pas d’erreur', async () => {
    // Un serveur injoignable n'est pas une erreur du visiteur : la
    // fonctionnalité n'est simplement pas proposée.
    installerEnvironnement({ notification: 'granted' })
    const fetchImpl: FetchSimule = vi.fn().mockRejectedValue(new Error('panne'))

    const resultat = await activerNotifications({ ...PARAMS, fetchImpl })

    expect(resultat.etat).toBe('non_configure')
  })

  it('mémorise l’abonnement pour les visites suivantes', async () => {
    installerEnvironnement({ notification: 'granted' })
    const fetchImpl = fauxFetch([
      { motif: 'config', corps: { configure: true, cle_publique: CLE_PUBLIQUE_TEST } },
      { motif: 'subscribe', corps: {} },
    ])

    await activerNotifications({ ...PARAMS, fetchImpl })

    const memorise = lireEtatNotifications()
    expect(memorise.abonne).toBe(true)
    expect(memorise.endpoint).toBe(ENDPOINT_TEST)
    expect(memorise.erreurLe).toBeNull()
  })
})

// ============================================================
// 6. DÉSABONNER — LE SERVEUR D'ABORD
// ============================================================

describe('Désabonnement', () => {
  it('prévient le serveur AVANT de désabonner le navigateur', async () => {
    const souscription = fausseSouscription()
    installerEnvironnement({ notification: 'granted', souscription })
    const ordre: string[] = []
    const fetchImpl: FetchSimule = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      ordre.push(String(init?.method ?? 'GET'))
      if (String(input).includes('unsubscribe')) return { ok: true, status: 200 } as unknown as Response
      throw new Error('inattendu')
    })
    souscription.unsubscribe.mockImplementation(async () => {
      ordre.push('navigateur')
      return true
    })

    const resultat = await desabonnerNotifications({ apiBase: PARAMS.apiBase, fetchImpl })

    expect(resultat.etat).toBe('inactif')
    expect(ordre).toEqual(['DELETE', 'navigateur'])
  })

  it('désabonne le navigateur et efface l’état mémorisé', async () => {
    const souscription = fausseSouscription()
    installerEnvironnement({ notification: 'granted', souscription })
    ecrireEtatNotifications({ abonne: true, endpoint: ENDPOINT_TEST, erreurLe: null })
    const fetchImpl = fauxFetch([{ motif: 'unsubscribe', corps: {} }])

    await desabonnerNotifications({ apiBase: PARAMS.apiBase, fetchImpl })

    expect(souscription.unsubscribe).toHaveBeenCalledTimes(1)
    expect(lireEtatNotifications().abonne).toBe(false)
    expect(lireEtatNotifications().endpoint).toBeNull()
  })

  it('conserve l’abonnement local si le serveur refuse : rien n’est à moitié fait', async () => {
    const souscription = fausseSouscription()
    installerEnvironnement({ notification: 'granted', souscription })
    ecrireEtatNotifications({ abonne: true, endpoint: ENDPOINT_TEST, erreurLe: null })
    const fetchImpl = fauxFetch([{ motif: 'unsubscribe', statut: 500, corps: {} }])

    const resultat = await desabonnerNotifications({ apiBase: PARAMS.apiBase, fetchImpl })

    expect(resultat.etat).toBe('erreur')
    expect(souscription.unsubscribe).not.toHaveBeenCalled()
    expect(lireEtatNotifications().abonne).toBe(true)
  })

  it('est idempotent quand rien n’est abonné', async () => {
    installerEnvironnement({ notification: 'granted' })
    const fetchImpl = fauxFetch([])

    const resultat = await desabonnerNotifications({ apiBase: PARAMS.apiBase, fetchImpl })

    expect(resultat.etat).toBe('inactif')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('utilise l’endpoint mémorisé si le navigateur ne rend plus d’abonnement', async () => {
    installerEnvironnement({ notification: 'granted', souscription: null })
    ecrireEtatNotifications({ abonne: true, endpoint: ENDPOINT_TEST, erreurLe: null })
    const fetchImpl = fauxFetch([{ motif: 'unsubscribe', corps: {} }])

    const resultat = await desabonnerNotifications({ apiBase: PARAMS.apiBase, fetchImpl })

    expect(resultat.etat).toBe('inactif')
    const url = String(fetchImpl.mock.calls[0][0])
    expect(url).toContain(encodeURIComponent(ENDPOINT_TEST))
  })
})

// ============================================================
// 7. RESYNCHRONISATION — SANS RIEN DEMANDER
// ============================================================

describe('Resynchronisation d’un abonnement déjà consenti', () => {
  it('ne fait rien si le visiteur n’a jamais activé les notifications', async () => {
    installerEnvironnement({ notification: 'granted' })
    const fetchImpl = fauxFetch([])

    expect(await resynchroniserAbonnement({ ...PARAMS, fetchImpl })).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('ne demande AUCUNE permission et ne fait rien si elle a été retirée', async () => {
    installerEnvironnement({ notification: 'default' })
    ecrireEtatNotifications({ abonne: true, endpoint: ENDPOINT_TEST, erreurLe: null })
    const fetchImpl = fauxFetch([])

    expect(await resynchroniserAbonnement({ ...PARAMS, fetchImpl })).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('réenregistre l’abonnement existant auprès du serveur', async () => {
    const souscription = fausseSouscription()
    installerEnvironnement({ notification: 'granted', souscription })
    ecrireEtatNotifications({ abonne: true, endpoint: ENDPOINT_TEST, erreurLe: null })
    const fetchImpl = fauxFetch([{ motif: 'subscribe', corps: {} }])

    expect(await resynchroniserAbonnement({ ...PARAMS, fetchImpl })).toBe(true)
    expect(souscription.endpoint).toBe(ENDPOINT_TEST)
    const corps = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))
    expect(corps.endpoint).toBe(ENDPOINT_TEST)
  })
})

// ============================================================
// 8. MÉMOIRE LOCALE
// ============================================================

describe('Mémoire locale de l’état', () => {
  it('part d’un état vide', () => {
    expect(lireEtatNotifications(localStorage)).toEqual({
      abonne: false,
      endpoint: null,
      erreurLe: null,
    })
  })

  it('relit ce qui a été écrit', () => {
    ecrireEtatNotifications({ abonne: true, endpoint: ENDPOINT_TEST, erreurLe: 123 }, localStorage)
    expect(lireEtatNotifications(localStorage)).toEqual({
      abonne: true,
      endpoint: ENDPOINT_TEST,
      erreurLe: 123,
    })
  })

  it('résiste à un contenu illisible', () => {
    localStorage.setItem(CLE_ETAT_NOTIFICATIONS, 'pas du json')
    expect(lireEtatNotifications(localStorage).abonne).toBe(false)
  })

  it('résiste à un stockage absent (navigation privée)', () => {
    expect(lireEtatNotifications(null).abonne).toBe(false)
    expect(() =>
      ecrireEtatNotifications({ abonne: true, endpoint: null, erreurLe: null }, null),
    ).not.toThrow()
  })
})
